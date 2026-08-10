import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ISearchService } from "../common/search.js";
import { SearchService } from "../common/searchService.js";
registerSingleton(ISearchService, SearchService, InstantiationType.Delayed);
