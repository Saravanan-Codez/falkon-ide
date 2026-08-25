/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IProcessEnvironment, isWindows, OperatingSystem } from '../../../../base/common/platform.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	IProcessDataEvent,
	IProcessProperty,
	IProcessReadyEvent,
	IShellLaunchConfig,
	ITerminalBackend,
	ITerminalBackendRegistry,
	ITerminalChildProcess,
	ITerminalLaunchError,
	ITerminalLaunchResult,
	ITerminalLogService,
	ITerminalProcessOptions,
	ITerminalProfile,
	ITerminalsLayoutInfo,
	ITerminalsLayoutInfoById,
	TerminalExtensions,
	TerminalIcon,
	TitleEventSource
} from '../../../../platform/terminal/common/terminal.js';
import { IProcessDetails } from '../../../../platform/terminal/common/terminalProcess.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { ITerminalInstanceService } from './terminal.js';

let _nextProcessId = 1;

export class TauriTerminalChildProcess extends Disposable implements ITerminalChildProcess {
	readonly id = _nextProcessId++;
	readonly shouldPersist = false;

	private _tauriSessionId: string | undefined;

	private readonly _onProcessData = this._register(new Emitter<IProcessDataEvent | string>());
	readonly onProcessData: Event<IProcessDataEvent | string> = this._onProcessData.event;

	private readonly _onProcessReady = this._register(new Emitter<IProcessReadyEvent>());
	readonly onProcessReady: Event<IProcessReadyEvent> = this._onProcessReady.event;

	private readonly _onDidChangeProperty = this._register(new Emitter<IProcessProperty>());
	readonly onDidChangeProperty: Event<IProcessProperty> = this._onDidChangeProperty.event;

	private readonly _onProcessExit = this._register(new Emitter<number | undefined>());
	readonly onProcessExit: Event<number | undefined> = this._onProcessExit.event;

	constructor(
		private readonly _cwd: string,
		private _cols: number,
		private _rows: number,
		private readonly _logService: ITerminalLogService
	) {
		super();
	}

	async start(): Promise<ITerminalLaunchError | ITerminalLaunchResult | undefined> {
		const tauriTerminal = (globalThis as any).__tauri_terminal__ || (window as any).__tauri_terminal__;
		if (!tauriTerminal) {
			return { message: 'Tauri terminal bridge not available' };
		}

		try {
			this._tauriSessionId = await tauriTerminal.create(this._cwd, this._cols, this._rows);
			this._logService.info(`[TauriTerminal] Created PTY session: ${this._tauriSessionId}`);

			tauriTerminal.onData(this._tauriSessionId, (data: string) => {
				if (typeof data === 'string' && data.length > 0) {
					this._onProcessData.fire(data);
					this._onProcessData.fire({ data, trackCommit: false } as any);
				}
			});

			tauriTerminal.onExit(this._tauriSessionId, () => {
				this._onProcessExit.fire(0);
			});

			this._onProcessReady.fire({
				pid: this.id,
				cwd: this._cwd,
				windowsPty: isWindows ? { backend: 'conpty', buildNumber: 19041 } as any : undefined
			});

			return undefined;
		} catch (err: any) {
			this._logService.error(`[TauriTerminal] Failed to start terminal:`, err);
			return { message: err?.message || String(err) };
		}
	}

	input(data: string): void {
		if (!this._tauriSessionId) return;
		const tauriTerminal = (globalThis as any).__tauri_terminal__;
		tauriTerminal?.write(this._tauriSessionId, data);
	}

	resize(cols: number, rows: number): void {
		this._cols = cols;
		this._rows = rows;
		if (!this._tauriSessionId) return;
		const tauriTerminal = (globalThis as any).__tauri_terminal__;
		tauriTerminal?.resize(this._tauriSessionId, cols, rows);
	}

	shutdown(immediate: boolean): void {
		if (!this._tauriSessionId) return;
		const tauriTerminal = (globalThis as any).__tauri_terminal__;
		tauriTerminal?.kill(this._tauriSessionId);
		this._tauriSessionId = undefined;
	}

	sendSignal(signal: string): void {}
	processBinary(data: string): Promise<void> { return Promise.resolve(); }
	clearBuffer(): void {}
	acknowledgeDataEvent(charCount: number): void {}
	async setUnicodeVersion(version: '6' | '11'): Promise<void> {}
	async getInitialCwd(): Promise<string> { return this._cwd; }
	async getCwd(): Promise<string> { return this._cwd; }
	async refreshProperty(property: any): Promise<any> { return undefined; }
	async updateProperty(property: any, value: any): Promise<void> {}
}

export class TauriTerminalBackend extends Disposable implements ITerminalBackend {
	readonly remoteAuthority = undefined;
	readonly isResponsive = true;
	readonly whenReady = Promise.resolve();

	private readonly _onPtyHostUnresponsive = this._register(new Emitter<void>());
	readonly onPtyHostUnresponsive = this._onPtyHostUnresponsive.event;

	private readonly _onPtyHostResponsive = this._register(new Emitter<void>());
	readonly onPtyHostResponsive = this._onPtyHostResponsive.event;

	private readonly _onPtyHostRestart = this._register(new Emitter<void>());
	readonly onPtyHostRestart = this._onPtyHostRestart.event;

	private readonly _onDidRequestDetach = this._register(new Emitter<{ requestId: number; workspaceId: string; instanceId: number }>());
	readonly onDidRequestDetach = this._onDidRequestDetach.event;

	constructor(
		@ITerminalLogService private readonly _logService: ITerminalLogService
	) {
		super();
	}

	setReady(): void {}

	async createProcess(
		shellLaunchConfig: IShellLaunchConfig,
		cwd: string,
		cols: number,
		rows: number,
		unicodeVersion: '6' | '11',
		env: IProcessEnvironment,
		options: ITerminalProcessOptions,
		shouldPersist: boolean
	): Promise<ITerminalChildProcess> {
		let targetCwd = '';
		if (typeof cwd === 'string' && cwd.length > 0) {
			targetCwd = cwd;
		} else if (shellLaunchConfig.cwd) {
			targetCwd = typeof shellLaunchConfig.cwd === 'string' ? shellLaunchConfig.cwd : (shellLaunchConfig.cwd.fsPath || shellLaunchConfig.cwd.path || '');
		}
		return new TauriTerminalChildProcess(targetCwd, cols, rows, this._logService);
	}

	async attachToProcess(id: number): Promise<ITerminalChildProcess | undefined> { return undefined; }
	async attachToRevivedProcess(id: number): Promise<ITerminalChildProcess | undefined> { return undefined; }
	async listProcesses(): Promise<IProcessDetails[]> { return []; }
	async getLatency(): Promise<any[]> { return []; }

	async getDefaultSystemShell(osOverride?: OperatingSystem): Promise<string> {
		if (isWindows) return 'powershell.exe';
		return '/bin/bash';
	}

	async getProfiles(profiles: unknown, defaultProfile: unknown, includeDetectedProfiles?: boolean): Promise<ITerminalProfile[]> {
		if (isWindows) {
			return [
				{ profileName: 'PowerShell', path: 'powershell.exe', isDefault: true },
				{ profileName: 'Command Prompt', path: 'cmd.exe', isDefault: false }
			];
		}
		return [
			{ profileName: 'bash', path: '/bin/bash', isDefault: true },
			{ profileName: 'sh', path: '/bin/sh', isDefault: false }
		];
	}

	async getWslPath(original: string, direction: 'unix-to-win' | 'win-to-unix'): Promise<string> { return original; }
	async getEnvironment(): Promise<IProcessEnvironment> { return {}; }
	async getShellEnvironment(): Promise<IProcessEnvironment | undefined> { return undefined; }
	async setTerminalLayoutInfo(layoutInfo?: ITerminalsLayoutInfoById): Promise<void> {}
	async updateTitle(id: number, title: string, titleSource: TitleEventSource): Promise<void> {}
	async updateIcon(id: number, userInitiated: boolean, icon: TerminalIcon, color?: string): Promise<void> {}
	async setNextCommandId(id: number, commandLine: string, commandId: string): Promise<void> {}
	async getTerminalLayoutInfo(): Promise<ITerminalsLayoutInfo | undefined> { return undefined; }
	async getPerformanceMarks(): Promise<any[]> { return []; }
	async reduceConnectionGraceTime(): Promise<void> {}
	async requestDetachInstance(workspaceId: string, instanceId: number): Promise<IProcessDetails | undefined> { return undefined; }
	async acceptDetachInstanceReply(requestId: number, persistentProcessId?: number): Promise<void> {}
	async persistTerminalState(): Promise<void> {}
	restartPtyHost(): void {}
	async installAutoReply(match: string, reply: string): Promise<void> {}
	async uninstallAllAutoReplies(): Promise<void> {}
}

import { ITerminalService } from './terminal.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';

export class TauriTerminalContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.tauriTerminal';

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@ITerminalInstanceService terminalInstanceService: ITerminalInstanceService,
		@ITerminalService terminalService: ITerminalService
	) {
		const backend = instantiationService.createInstance(TauriTerminalBackend);
		Registry.as<ITerminalBackendRegistry>(TerminalExtensions.Backend).registerTerminalBackend(backend);
		terminalInstanceService.didRegisterBackend(backend);
		terminalService.registerProcessSupport(true);
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(TauriTerminalContribution, LifecyclePhase.Restored);
