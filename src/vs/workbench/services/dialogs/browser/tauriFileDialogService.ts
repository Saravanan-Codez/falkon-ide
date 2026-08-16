/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPickAndOpenOptions, ISaveDialogOptions, IOpenDialogOptions, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { URI } from '../../../../base/common/uri.js';
import { AbstractFileDialogService } from './abstractFileDialogService.js';
import { Schemas } from '../../../../base/common/network.js';

export class TauriFileDialogService extends AbstractFileDialogService implements IFileDialogService {

	async pickFileToSave(defaultUri: URI, availableFileSystems?: string[]): Promise<URI | undefined> {
		return this.showSaveDialog({ defaultUri, availableFileSystems });
	}

	private get tauriDialogs(): any {
		const win = window as any;
		if (win.__tauri_dialogs__) {
			return win.__tauri_dialogs__;
		}
		if ((globalThis as any).__tauri_dialogs__) {
			return (globalThis as any).__tauri_dialogs__;
		}
		if (win.__TAURI__?.core?.invoke || win.__TAURI_INTERNALS__?.invoke) {
			const invoke = (cmd: string, args?: any) => {
				if (win.__TAURI__?.core?.invoke) return win.__TAURI__.core.invoke(cmd, args);
				return win.__TAURI_INTERNALS__.invoke(cmd, args);
			};
			return {
				openFolder: () => invoke('open_folder_dialog', {}),
				openFile: (filters?: any) => invoke('open_file_dialog', { filters: filters ?? [] }),
				saveFile: (defaultName?: any) => invoke('save_file_dialog', { defaultName: defaultName ?? null })
			};
		}
		return undefined;
	}

	private openFolderInWorkspace(path: string) {
		const url = new URL(window.location.href);
		url.searchParams.set('folder', path);
		window.location.href = url.toString();
	}

	async pickFileFolderAndOpen(options: IPickAndOpenOptions): Promise<void> {
		if (this.tauriDialogs) {
			const path = await this.tauriDialogs.openFolder();
			if (path) {
				this.openFolderInWorkspace(path);
			}
			return;
		}
		const schema = this.getFileSystemSchema(options);
		return super.pickFileFolderAndOpenSimplified(schema, options, false);
	}

	protected override addFileSchemaIfNeeded(schema: string, isFolder: boolean): string[] {
		return (schema === Schemas.untitled) ? [Schemas.file]
			: (((schema !== Schemas.file) && (!isFolder || (schema !== Schemas.vscodeRemote))) ? [schema, Schemas.file] : [schema]);
	}

	async pickFileAndOpen(options: IPickAndOpenOptions): Promise<void> {
		if (this.tauriDialogs) {
			const path = await this.tauriDialogs.openFile();
			if (path) {
				const uri = URI.file(path);
				this.addFileToRecentlyOpened(uri);
				await this.openerService.open(uri, { fromUserGesture: true, editorOptions: { pinned: true } });
			}
			return;
		}
		const schema = this.getFileSystemSchema(options);
		return super.pickFileAndOpenSimplified(schema, options, false);
	}

	async pickFolderAndOpen(options: IPickAndOpenOptions): Promise<void> {
		if (this.tauriDialogs) {
			const path = await this.tauriDialogs.openFolder();
			if (path) {
				this.openFolderInWorkspace(path);
			}
			return;
		}
		const schema = this.getFileSystemSchema(options);
		return super.pickFolderAndOpenSimplified(schema, options);
	}

	async pickWorkspaceAndOpen(options: IPickAndOpenOptions): Promise<void> {
		if (this.tauriDialogs) {
			const path = await this.tauriDialogs.openFolder();
			if (path) {
				this.openFolderInWorkspace(path);
			}
			return;
		}
		const schema = this.getFileSystemSchema(options);
		return super.pickWorkspaceAndOpenSimplified(schema, options);
	}

	async showSaveDialog(options: ISaveDialogOptions): Promise<URI | undefined> {
		if (this.tauriDialogs) {
			const path = await this.tauriDialogs.saveFile();
			if (path) {
				return URI.file(path);
			}
			return undefined;
		}
		const schema = this.getFileSystemSchema(options);
		return super.showSaveDialogSimplified(schema, options);
	}

	async showOpenDialog(options: IOpenDialogOptions): Promise<URI[] | undefined> {
		if (this.tauriDialogs) {
			const isFolder = options.canSelectFolders && !options.canSelectFiles;
			const path = isFolder ? await this.tauriDialogs.openFolder() : await this.tauriDialogs.openFile();
			if (path) {
				return [URI.file(path)];
			}
			return undefined;
		}
		const schema = this.getFileSystemSchema(options);
		return super.showOpenDialogSimplified(schema, options);
	}
}
