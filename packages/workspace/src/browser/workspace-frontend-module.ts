/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule, interfaces } from 'inversify';
import { CommandContribution, MenuContribution } from "@theia/core/lib/common";
import { WebSocketConnectionProvider, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { WorkspaceServer, workspacePath } from '../common';
import { WorkspaceService } from './workspace-service';
import { WorkspaceCommandContribution, FileMenuContribution } from './workspace-commands';

export default new ContainerModule((bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind) => {
    bind(WorkspaceService).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toDynamicValue(ctx => ctx.container.get(WorkspaceService));
    bind(WorkspaceServer).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<WorkspaceServer>(workspacePath);
    }).inSingletonScope();

    bind(CommandContribution).to(WorkspaceCommandContribution).inSingletonScope();
    bind(MenuContribution).to(FileMenuContribution).inSingletonScope();
});
