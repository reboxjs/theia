/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import {
    injectable,
} from 'inversify';
import URI from '@theia/core/lib/common/uri';

import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';

/**
 * The workspace service.
 */
@injectable()
export class WorkspaceService implements FrontendApplicationContribution {

    protected updateTitle(uri: URI): void {
        document.title = uri.displayName;
    }

    /**
     * on unload, we set our workspace root as the last recently used on the backend.
     * @param app
     */
    onStop(app: FrontendApplication): void {
    }

    protected openWindow(uri: URI, options?: WorkspaceInput): void {
        this.reloadWindow();
    }

    protected reloadWindow(): void {
        window.location.reload();
    }

    protected shouldPreserveWindow(options?: WorkspaceInput): boolean {
        return options !== undefined && !!options.preserveWindow;
    }

}

export interface WorkspaceInput {

    /**
     * Tests whether the same window should be used or a new one has to be opened after setting the workspace root. By default it is `false`.
     */
    preserveWindow?: boolean;

}
