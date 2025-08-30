import { App, SuggestModal, TFolder } from 'obsidian';

// Modal for selecting folders from vault
export class FolderSelectorModal extends SuggestModal<TFolder> {
	private onSelect: (folder: TFolder) => void;

	constructor(app: App, onSelect: (folder: TFolder) => void) {
		super(app);
		this.onSelect = onSelect;
	}

	// Get filtered folder suggestions based on query
	getSuggestions(query: string): TFolder[] {
		const folders: TFolder[] = [];
		
		// Recursively collect all folders in vault
		const collectFolders = (folder: TFolder) => {
			folders.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					collectFolders(child);
				}
			}
		};

		// Start from vault root
		const rootFolder = this.app.vault.getRoot();
		for (const child of rootFolder.children) {
			if (child instanceof TFolder) {
				collectFolders(child);
			}
		}

		return folders.filter(folder => 
			folder.path.toLowerCase().includes(query.toLowerCase())
		);
	}

	// Render folder path in suggestion list
	renderSuggestion(folder: TFolder, el: HTMLElement) {
		el.createEl("div", { text: folder.path });
	}

	// Handle folder selection
	onChooseSuggestion(folder: TFolder) {
		this.onSelect(folder);
	}
}