/*
 * Copyright (C) 2017 Erisson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from "inversify";
import { SearchInWorkspaceService, SearchInWorkspaceClientImpl } from '../common/search-in-workspace-service';
import { SearchInWorkspaceServer } from '../common/search-in-workspace-interface';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser';
import {
    QuickSearchInWorkspace,
    SearchInWorkspaceCommandContribution,
    SearchInWorkspaceMenuContribution,
    QuickSearchInWorkspaceKeybindingContribution
} from './quick-search-in-workspace';
import {
    CommandContribution,
    MenuContribution,
    KeybindingContribution
} from "@theia/core";

export default new ContainerModule(bind => {
    bind(QuickSearchInWorkspace).toSelf().inSingletonScope();

    /* Command contribution */
    bind(CommandContribution).to(SearchInWorkspaceCommandContribution).inSingletonScope();

    /* Menu contribution */
    bind(MenuContribution).to(SearchInWorkspaceMenuContribution).inSingletonScope();

    /* Keybinding contribution */
    bind(KeybindingContribution).to(QuickSearchInWorkspaceKeybindingContribution).inSingletonScope();

    /* The object that gets notified of search results.  */
    bind(SearchInWorkspaceClientImpl).toSelf().inSingletonScope();

    bind(SearchInWorkspaceService).toSelf().inSingletonScope();

    /* The object to call methods on the backend.  */
    bind(SearchInWorkspaceServer).toDynamicValue(ctx => {
        const client = ctx.container.get(SearchInWorkspaceClientImpl);
        return WebSocketConnectionProvider.createProxy(ctx.container, '/search-in-workspace', client);
    }).inSingletonScope();
});
