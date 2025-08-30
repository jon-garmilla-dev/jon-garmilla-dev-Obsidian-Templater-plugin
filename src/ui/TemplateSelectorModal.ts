import { App, SuggestModal, TFile, TFolder } from 'obsidian';

// Modal for selecting templates in grouped mode
export class TemplateSelectorModal extends SuggestModal<TFile | TFolder> {
	private templates: (TFile | TFolder)[];
	private onSelect: (template: TFile | TFolder) => void;

	constructor(app: App, templates: (TFile | TFolder)[], onSelect: (template: TFile | TFolder) => void) {
		super(app);
		this.templates = templates;
		this.onSelect = onSelect;
	}

	// Filter templates based on search query
	getSuggestions(query: string): (TFile | TFolder)[] {
		return this.templates.filter(template => 
			template.name.toLowerCase().includes(query.toLowerCase())
		);
	}

	// Render template suggestion with type and path
	renderSuggestion(template: TFile | TFolder, el: HTMLElement) {
		const type = template instanceof TFolder ? "Folder" : "File";
		
		el.createEl("div", { text: template.name });
		el.createEl("small", { text: `${type} - ${template.path}`, cls: "template-path" });
	}

	// Handle template selection
	onChooseSuggestion(template: TFile | TFolder) {
		this.onSelect(template);
	}
}