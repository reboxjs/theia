/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from 'inversify';
import {
    CommandContribution, MenuContribution,
    KeybindingContribution, KeybindingContext
} from "@theia/core/lib/common";
import { OpenHandler, WidgetFactory, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { EditorManagerImpl, EditorManager } from './editor-manager';
import { EditorContribution } from './editor-contribution';
import { EditorMenuContribution } from './editor-menu';
import { EditorCommandContribution } from './editor-command';
import { EditorKeybindingContribution, EditorKeybindingContext } from "./editor-keybinding";
import { LabelProviderContribution } from '@theia/core/lib/browser/label-provider';
import { DiffUriLabelProviderContribution } from './diff-uris';

export default new ContainerModule(bind => {
    bind(EditorManagerImpl).toSelf().inSingletonScope();
    bind(EditorManager).toDynamicValue(c => c.container.get(EditorManagerImpl)).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(c => c.container.get(EditorManagerImpl)).inSingletonScope();
    bind(OpenHandler).toDynamicValue(context => context.container.get(EditorManager)).inSingletonScope();

    bind(CommandContribution).to(EditorCommandContribution).inSingletonScope();
    bind(MenuContribution).to(EditorMenuContribution).inSingletonScope();
    bind(EditorKeybindingContext).toSelf().inSingletonScope();

    bind(KeybindingContext).toDynamicValue(context => context.container.get(EditorKeybindingContext)).inSingletonScope();
    bind(KeybindingContribution).to(EditorKeybindingContribution).inSingletonScope();

    bind(EditorContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toDynamicValue(c => c.container.get(EditorContribution));

    bind(LabelProviderContribution).to(DiffUriLabelProviderContribution).inSingletonScope();
});
