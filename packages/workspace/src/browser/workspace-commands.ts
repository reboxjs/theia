/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from 'inversify';
import URI from "@theia/core/lib/common/uri";
import { SelectionService } from '@theia/core/lib/common';
import {
    CommandContribution, CommandHandler, CommandRegistry
} from '@theia/core/lib/common/command';
import { FileSystem } from '@theia/filesystem/lib/common/filesystem';
import { UriSelection } from '@theia/filesystem/lib/common/filesystem-selection';
import {
    OpenerService,
    FrontendApplication
} from "@theia/core/lib/browser";
import { WorkspaceService } from './workspace-service';

@injectable()
export class WorkspaceCommandContribution implements CommandContribution {
    constructor(
        @inject(FileSystem) protected readonly fileSystem: FileSystem,
        @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService,
        @inject(SelectionService) protected readonly selectionService: SelectionService,
        @inject(OpenerService) protected readonly openerService: OpenerService,
        @inject(FrontendApplication) protected readonly app: FrontendApplication
    ) { }

    registerCommands(registry: CommandRegistry): void {
    }

    protected newFileHandler(handler: UriCommandHandler): FileSystemCommandHandler {
        return new FileSystemCommandHandler(this.selectionService, handler);
    }

    protected newWorkspaceHandler(handler: UriCommandHandler): WorkspaceRootAwareCommandHandler {
        return new WorkspaceRootAwareCommandHandler(this.workspaceService, this.selectionService, handler);
    }
}

export interface UriCommandHandler {
    execute(uri: URI, ...args: any[]): any;
    isEnabled?(uri: URI, ...args: any[]): boolean;
    isVisible?(uri: URI, ...args: any[]): boolean;
}
export class FileSystemCommandHandler implements CommandHandler {
    constructor(
        protected readonly selectionService: SelectionService,
        protected readonly handler: UriCommandHandler
    ) { }

    protected getUri(...args: any[]): URI | undefined {
        if (args && args[0] instanceof URI) {
            return args[0];
        }
        return UriSelection.getUri(this.selectionService.selection);
    }

    execute(...args: any[]): object | undefined {
        const uri = this.getUri(...args);
        return uri ? this.handler.execute(uri, ...args) : undefined;
    }

    isVisible(...args: any[]): boolean {
        const uri = this.getUri(...args);
        if (uri) {
            if (this.handler.isVisible) {
                return this.handler.isVisible(uri, ...args);
            }
            return true;
        }
        return false;
    }

    isEnabled(...args: any[]): boolean {
        const uri = this.getUri(...args);
        if (uri) {
            if (this.handler.isEnabled) {
                return this.handler.isEnabled(uri, ...args);
            }
            return true;
        }
        return false;
    }

}

export class WorkspaceRootAwareCommandHandler extends FileSystemCommandHandler {

    protected rootUri: URI | undefined;

    constructor(
        protected readonly workspaceService: WorkspaceService,
        protected readonly selectionService: SelectionService,
        protected readonly handler: UriCommandHandler
    ) {
        super(selectionService, handler);
        workspaceService.root.then(root => {
            if (root) {
                this.rootUri = new URI(root.uri);
            }
        });
    }

    protected getUri(): URI | undefined {
        return UriSelection.getUri(this.selectionService.selection) || this.rootUri;
    }
}
