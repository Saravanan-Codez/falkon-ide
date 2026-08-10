import { IImageResizeService } from "../../../../platform/imageResize/common/imageResizeService.js";
import { ImageResizeService } from "../../../../platform/imageResize/browser/imageResizeService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
registerSingleton(IImageResizeService, ImageResizeService, InstantiationType.Delayed);
