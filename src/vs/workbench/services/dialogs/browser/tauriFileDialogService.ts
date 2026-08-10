/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPickAndOpenOptions, ISaveDialogOptions, IOpenDialogOptions, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { URI } from '../../../../base/common/uri.js';
import { AbstractFileDialogService } from './abstractFileDialogService.js';
import { Schemas } from '../../../../base/common/network.js';

export class TauriFileDialogService extends AbstractFileDialogService implements IFileDialogService {

	private get tauriDialogs(): any {
		return (globalThis as any).__tauri_dialogs__ || (window as any).__tauri_dialogs__;
	}

	async pickFileFolderAndOpen(options: IPickAndOpenOptions): Promise<void> {
		if (this.tauriDialogs) {
			const path = await this.tauriDialogs.openFolder();
			if (path) {
				await this.hostService.openWindow([{ folderUri: URI.file(path) }], { forceReuseWindow: true });
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
				await this.hostService.openWindow([{ folderUri: URI.file(path) }], { forceReuseWindow: true });
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
				await this.hostService.openWindow([{ folderUri: URI.file(path) }], { forceReuseWindow: true });
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
