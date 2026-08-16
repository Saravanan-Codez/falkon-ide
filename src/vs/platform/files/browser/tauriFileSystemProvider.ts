/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../base/common/uri.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { Event } from '../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../base/common/lifecycle.js';
import { isLinux, isWindows } from '../../../base/common/platform.js';
import { newWriteableStream, ReadableStreamEvents } from '../../../base/common/stream.js';
import {
	createFileSystemProviderError,
	IFileDeleteOptions,
	IFileOverwriteOptions,
	IFileReadStreamOptions,
	FileSystemProviderCapabilities,
	FileSystemProviderErrorCode,
	FileType,
	IFileWriteOptions,
	IFileSystemProviderWithFileReadStreamCapability,
	IFileSystemProviderWithFileReadWriteCapability,
	IStat,
	IWatchOptions
} from '../common/files.js';
import { ILogService } from '../../log/common/log.js';

interface ITauriFS {
	readFile(path: string): Promise<string | null>;
	writeFile(path: string, content: string): Promise<boolean>;
	readDir(path: string): Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean; isSymlink: boolean; size?: number; mtime?: number; ctime?: number }> | null>;
	stat(path: string): Promise<{ isDirectory: boolean; isFile: boolean; isSymlink: boolean; size?: number; mtime?: number; ctime?: number } | null>;
	exists(path: string): Promise<boolean>;
	mkdir(path: string): Promise<boolean>;
	rename(oldPath: string, newPath: string): Promise<boolean>;
	delete(path: string): Promise<boolean>;
}

export class TauriFileSystemProvider extends Disposable implements IFileSystemProviderWithFileReadWriteCapability, IFileSystemProviderWithFileReadStreamCapability {

	readonly onDidChangeCapabilities = Event.None;
	readonly onDidChangeFile = Event.None;
	readonly onDidWatchError = Event.None;

	private _capabilities: FileSystemProviderCapabilities | undefined;
	get capabilities(): FileSystemProviderCapabilities {
		if (!this._capabilities) {
			this._capabilities =
				FileSystemProviderCapabilities.FileReadWrite |
				FileSystemProviderCapabilities.FileReadStream |
				FileSystemProviderCapabilities.FileFolderCopy |
				FileSystemProviderCapabilities.FileWriteUnlock;

			if (isLinux) {
				this._capabilities |= FileSystemProviderCapabilities.PathCaseSensitive;
			}
		}

		return this._capabilities;
	}

	constructor(
		logService: ILogService
	) {
		super();
	}

	private get tauriFs(): ITauriFS {
		const fs = (globalThis as any).__tauri_fs__ || (window as any).__tauri_fs__;
		if (!fs) {
			throw createFileSystemProviderError('Tauri File System Bridge is not initialized', FileSystemProviderErrorCode.Unavailable);
		}
		return fs;
	}

	private uriToPath(resource: URI): string {
		let path = decodeURIComponent(resource.path || resource.fsPath || '');
		if (isWindows) {
			if (path.startsWith('/')) {
				path = path.slice(1);
			}
			path = path.replace(/\//g, '\\');
		}
		return path;
	}

	//#region File Metadata Resolving

	async stat(resource: URI): Promise<IStat> {
		const path = this.uriToPath(resource);
		try {
			const stat = await this.tauriFs.stat(path);
			if (!stat) {
				throw createFileSystemProviderError(`File not found: ${path}`, FileSystemProviderErrorCode.FileNotFound);
			}

			let type = FileType.File;
			if (stat.isDirectory) {
				type = FileType.Directory;
			} else if (stat.isSymlink) {
				type = FileType.SymbolicLink;
			}

			return {
				type,
				ctime: stat.ctime ?? 0,
				mtime: stat.mtime ?? 0,
				size: stat.size ?? 0
			};
		} catch (error) {
			throw createFileSystemProviderError(`Unable to stat file: ${path} (${error})`, FileSystemProviderErrorCode.FileNotFound);
		}
	}

	async readdir(resource: URI): Promise<[string, FileType][]> {
		const path = this.uriToPath(resource);
		try {
			const entries = await this.tauriFs.readDir(path);
			if (!entries) {
				return [];
			}

			return entries.map(entry => [
				entry.name,
				entry.isDirectory ? FileType.Directory : entry.isSymlink ? FileType.SymbolicLink : FileType.File
			]);
		} catch (error) {
			throw createFileSystemProviderError(`Unable to read directory: ${path} (${error})`, FileSystemProviderErrorCode.FileNotFound);
		}
	}

	//#endregion

	//#region File Reading/Writing

	async readFile(resource: URI): Promise<Uint8Array> {
		const path = this.uriToPath(resource);
		try {
			const content = await this.tauriFs.readFile(path);
			if (content === null || content === undefined) {
				throw createFileSystemProviderError(`File not found: ${path}`, FileSystemProviderErrorCode.FileNotFound);
			}
			return new TextEncoder().encode(content);
		} catch (error) {
			throw createFileSystemProviderError(`Unable to read file: ${path} (${error})`, FileSystemProviderErrorCode.FileNotFound);
		}
	}

	readFileStream(resource: URI, opts: IFileReadStreamOptions, token: CancellationToken): ReadableStreamEvents<Uint8Array> {
		const stream = newWriteableStream<Uint8Array>(data => VSBuffer.concat(data.map(d => VSBuffer.wrap(d))).buffer);

		(async () => {
			try {
				let buffer = await this.readFile(resource);

				if (typeof opts.position === 'number') {
					buffer = buffer.slice(opts.position);
				}

				if (typeof opts.length === 'number') {
					buffer = buffer.slice(0, opts.length);
				}

				stream.end(buffer);
			} catch (error) {
				stream.error(error as Error);
				stream.end();
			}
		})();

		return stream;
	}

	async writeFile(resource: URI, content: Uint8Array, opts: IFileWriteOptions): Promise<void> {
		const path = this.uriToPath(resource);
		try {
			const text = new TextDecoder('utf-8').decode(content);
			const ok = await this.tauriFs.writeFile(path, text);
			if (!ok) {
				throw createFileSystemProviderError(`Failed to write file: ${path}`, FileSystemProviderErrorCode.NoPermissions);
			}
		} catch (error) {
			throw createFileSystemProviderError(`Unable to write file: ${path} (${error})`, FileSystemProviderErrorCode.NoPermissions);
		}
	}

	async mkdir(resource: URI): Promise<void> {
		const path = this.uriToPath(resource);
		try {
			await this.tauriFs.mkdir(path);
		} catch (error) {
			throw createFileSystemProviderError(`Unable to create folder: ${path} (${error})`, FileSystemProviderErrorCode.NoPermissions);
		}
	}

	async delete(resource: URI, opts: IFileDeleteOptions): Promise<void> {
		const path = this.uriToPath(resource);
		try {
			await this.tauriFs.delete(path);
		} catch (error) {
			throw createFileSystemProviderError(`Unable to delete file: ${path} (${error})`, FileSystemProviderErrorCode.FileNotFound);
		}
	}

	async rename(from: URI, to: URI, opts: IFileOverwriteOptions): Promise<void> {
		const fromPath = this.uriToPath(from);
		const toPath = this.uriToPath(to);
		try {
			await this.tauriFs.rename(fromPath, toPath);
		} catch (error) {
			throw createFileSystemProviderError(`Unable to rename from ${fromPath} to ${toPath} (${error})`, FileSystemProviderErrorCode.NoPermissions);
		}
	}

	async copy(from: URI, to: URI, opts: IFileOverwriteOptions): Promise<void> {
		const fromPath = this.uriToPath(from);
		const toPath = this.uriToPath(to);
		try {
			const content = await this.tauriFs.readFile(fromPath);
			if (content !== null && content !== undefined) {
				await this.tauriFs.writeFile(toPath, content);
			}
		} catch (error) {
			throw createFileSystemProviderError(`Unable to copy from ${fromPath} to ${toPath} (${error})`, FileSystemProviderErrorCode.NoPermissions);
		}
	}

	//#endregion

	watch(resource: URI, opts: IWatchOptions): IDisposable {
		return { dispose: () => { } };
	}
}
