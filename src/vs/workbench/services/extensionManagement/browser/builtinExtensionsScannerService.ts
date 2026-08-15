/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IBuiltinExtensionsScannerService, ExtensionType, IExtensionManifest, TargetPlatform, IExtension } from '../../../../platform/extensions/common/extensions.js';
import { Language } from '../../../../base/common/platform.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { getGalleryExtensionId } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { builtinExtensionsPath, FileAccess } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { IExtensionResourceLoaderService } from '../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { ITranslations, localizeManifest } from '../../../../platform/extensionManagement/common/extensionNls.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { mainWindow } from '../../../../base/browser/window.js';

interface IBundledExtension {
	extensionPath: string;
	packageJSON: IExtensionManifest;
	packageNLS?: ITranslations;
	readmePath?: string;
	changelogPath?: string;
}

export class BuiltinExtensionsScannerService implements IBuiltinExtensionsScannerService {

	declare readonly _serviceBrand: undefined;

	// Cache the resolved extension list so scanBuiltinExtensions() never rebuilds promises
	private readonly _cachedExtensions: Promise<IExtension[]>;

	private nlsUrl: URI | undefined;

	constructor(
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@IUriIdentityService uriIdentityService: IUriIdentityService,
		@IExtensionResourceLoaderService private readonly extensionResourceLoaderService: IExtensionResourceLoaderService,
		@IProductService productService: IProductService,
		@ILogService private readonly logService: ILogService
	) {
		const nlsBaseUrl = productService.extensionsGallery?.nlsBaseUrl;
		if (nlsBaseUrl && productService.commit && !Language.isDefaultVariant()) {
			this.nlsUrl = URI.joinPath(URI.parse(nlsBaseUrl), productService.commit, productService.version, Language.value());
		}

		// Read bundled extension list from DOM meta tag (injected by bundle-vscode-tauri.js)
		let bundledExtensions: IBundledExtension[] = [];
		try {
			const el = mainWindow.document?.getElementById('vscode-workbench-builtin-extensions');
			const attr = el?.getAttribute('data-settings');
			if (attr) {
				bundledExtensions = JSON.parse(attr);
			}
		} catch { /* ignore */ }

		const builtinExtensionsServiceUrl = FileAccess.asBrowserUri(builtinExtensionsPath);
		const baseUrl = builtinExtensionsServiceUrl ?? URI.parse('./extensions/', true);

		// Build ONE promise array, then cache the combined result
		const promises = bundledExtensions.map(async e => {
			const id = getGalleryExtensionId(e.packageJSON.publisher, e.packageJSON.name);
			const manifest = e.packageNLS
				? await this.localizeManifest(id, e.packageJSON, e.packageNLS)
				: e.packageJSON;
			return {
				identifier: { id },
				location: uriIdentityService.extUri.joinPath(baseUrl, e.extensionPath),
				type: ExtensionType.System,
				isBuiltin: true,
				manifest,
				readmeUrl: e.readmePath
					? uriIdentityService.extUri.joinPath(baseUrl, e.readmePath)
					: undefined,
				changelogUrl: e.changelogPath
					? uriIdentityService.extUri.joinPath(baseUrl, e.changelogPath)
					: undefined,
				// WEB keeps extension processes lightweight; UNDEFINED causes native worker spawns
				targetPlatform: TargetPlatform.WEB,
				validations: [],
				isValid: true,
				preRelease: false,
			} satisfies IExtension;
		});

		// Cache once — subsequent calls to scanBuiltinExtensions() return instantly
		this._cachedExtensions = Promise.all(promises);
	}

	async scanBuiltinExtensions(): Promise<IExtension[]> {
		return this._cachedExtensions;
	}

	private async localizeManifest(extensionId: string, manifest: IExtensionManifest, fallbackTranslations: ITranslations): Promise<IExtensionManifest> {
		if (!this.nlsUrl) {
			return localizeManifest(this.logService, manifest, fallbackTranslations);
		}
		const uri = URI.joinPath(this.nlsUrl, extensionId, 'package');
		try {
			const res = await this.extensionResourceLoaderService.readExtensionResource(uri);
			const json = JSON.parse(res.toString());
			return localizeManifest(this.logService, manifest, json, fallbackTranslations);
		} catch (e) {
			this.logService.error(e);
			return localizeManifest(this.logService, manifest, fallbackTranslations);
		}
	}
}

registerSingleton(IBuiltinExtensionsScannerService, BuiltinExtensionsScannerService, InstantiationType.Delayed);
