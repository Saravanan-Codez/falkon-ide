import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { externalUriOpenersConfigurationNode } from "./configuration.js";
import { ExternalUriOpenerService, IExternalUriOpenerService } from "./externalUriOpenerService.js";
registerSingleton(IExternalUriOpenerService, ExternalUriOpenerService, InstantiationType.Delayed);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration(externalUriOpenersConfigurationNode);
