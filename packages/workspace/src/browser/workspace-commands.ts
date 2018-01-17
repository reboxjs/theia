/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from 'inversify';
import URI from "@theia/core/lib/common/uri";
import { SelectionService } from '@theia/core/lib/common';
import { Command, CommandContribution, CommandHandler, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { CommonMenus } from "@theia/core/lib/browser/common-frontend-contribution";
import { FileSystem, FileStat } from '@theia/filesystem/lib/common/filesystem';
import { UriSelection } from '@theia/filesystem/lib/common/filesystem-selection';
import { SingleTextInputDialog } from "@theia/core/lib/browser/dialogs";
import { OpenerService, open, FrontendApplication } from "@theia/core/lib/browser";
import { WorkspaceService } from './workspace-service';

const validFilename = require('valid-filename');

export namespace WorkspaceCommands {
    export const NEW_FILE: Command = {
        id: 'file.newFile',
        label: 'New File'
    };
}

@injectable()
export class FileMenuContribution implements MenuContribution {

    registerMenus(registry: MenuModelRegistry) {
        registry.registerMenuAction(CommonMenus.FILE_NEW, {
            commandId: WorkspaceCommands.NEW_FILE.id
        });
    }
}

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
        registry.registerCommand(WorkspaceCommands.NEW_FILE, this.newWorkspaceHandler({
            execute: uri => this.getDirectory(uri).then(parent => {
                const parentUri = new URI(parent.uri);
                const vacantChildUri = this.findVacantChildUri(parentUri, parent, 'Untitled', '.txt');
                const dialog = new SingleTextInputDialog({
                    title: `New File`,
                    initialValue: vacantChildUri.path.base,
                    validate: name => this.validateFileName(name, parent)
                });
                dialog.open().then(name => {
                    const fileUri = parentUri.resolve(name);
                    this.fileSystem.createFile(fileUri.toString()).then(() => {
                        open(this.openerService, fileUri);
                    });
                });
            })
        }));
    }

    protected newFileHandler(handler: UriCommandHandler): FileSystemCommandHandler {
        return new FileSystemCommandHandler(this.selectionService, handler);
    }

    protected newWorkspaceHandler(handler: UriCommandHandler): WorkspaceRootAwareCommandHandler {
        return new WorkspaceRootAwareCommandHandler(this.workspaceService, this.selectionService, handler);
    }

    /**
     * returns an error message or an empty string if the file name is valid
     * @param name the simple file name to validate
     * @param parent the parent directory's file stat
     */
    protected validateFileName(name: string, parent: FileStat): string {
        if (!validFilename(name)) {
            return "Invalid name, try other";
        }
        if (parent.children) {
            for (const child of parent.children) {
                if (new URI(child.uri).path.base === name) {
                    return 'A file with this name already exists.';
                }
            }
        }
        return '';
    }

    protected async getDirectory(candidate: URI): Promise<FileStat> {
        const stat = await this.fileSystem.getFileStat(candidate.toString());
        if (stat.isDirectory) {
            return stat;
        }
        return this.getParent(candidate);
    }

    protected getParent(candidate: URI): Promise<FileStat> {
        return this.fileSystem.getFileStat(candidate.parent.toString());
    }

    protected findVacantChildUri(parentUri: URI, parent: FileStat, name: string, ext: string = ''): URI {
        const children = !parent.children ? [] : parent.children!.map(child => new URI(child.uri));

        let index = 1;
        let base = name + ext;
        while (children.some(child => child.path.base === base)) {
            index = index + 1;
            base = name + '_' + index + ext;
        }
        return parentUri.resolve(base);
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
