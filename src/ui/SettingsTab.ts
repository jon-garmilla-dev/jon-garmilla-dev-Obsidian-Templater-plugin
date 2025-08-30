import { App, PluginSettingTab, Setting, TFolder, TFile, Modal } from 'obsidian';
import { TemplaterDirSettings, TemplateConfig } from '../types/settings';
import { FolderSelectorModal } from './FolderSelectorModal';

// Plugin settings interface
export class TemplaterDirSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: any,
		private settings: TemplaterDirSettings,
		private saveSettings: () => Promise<void>,
		private onTemplateMenuStyleChange: (value: 'grouped' | 'individual') => Promise<void>
	) {
		super(app, plugin);
	}

	// Render settings interface
	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Templates folder location')
			.setDesc('Files in this folder will be available as templates.')
			.addText(text => {
				text.setPlaceholder('Example: Templates/Weekly/...')
					.setValue(this.settings.templateFolder)
					.onChange(async (value) => {
						this.settings.templateFolder = value || 'Templates';
						await this.saveSettings();
					});
				
				// Show folder dropdown on click, not focus
				const inputEl = text.inputEl;
				inputEl.addEventListener('click', () => {
					this.showFolderSuggestions(inputEl);
				});
			});

		// Variables documentation link
		const docSetting = new Setting(containerEl)
			.setName('Internal variables and functions');
		
		// Create clickable documentation link
		const descEl = docSetting.descEl;
		descEl.empty();
		descEl.appendText('Templater Dir provides multiple predefined variables/functions that you can use. Check the ');
		
		const linkEl = descEl.createEl('a', {
			text: 'documentation',
			href: '#',
			cls: 'variables-doc-link'
		});
		linkEl.style.cssText = 'color: var(--text-accent); text-decoration: underline;';
		
		descEl.appendText(' to get a list of all the available internal variables/functions.');
		
		// Handle documentation link clicks
		linkEl.addEventListener('click', (e) => {
			e.preventDefault();
			this.showVariablesDocumentation();
		});

		new Setting(containerEl)
			.setName('Enable folder templates')
			.setDesc('Allows creating complete folder structures from template folders. Folders in your templates location will be available as templates.')
			.addToggle(toggle => toggle
				.setValue(this.settings.enableFolderTemplates)
				.onChange(async (value) => {
					this.settings.enableFolderTemplates = value;
					await this.saveSettings();
				}));


		new Setting(containerEl)
			.setName('Template Variables')
			.setDesc('Enable variable replacement in templates ({{date}}, {{dayName}}, {{+Number}}, etc.)')
			.addToggle(toggle => toggle
				.setValue(this.settings.dateVariables)
				.onChange(async (value) => {
					this.settings.dateVariables = value;
					await this.saveSettings();
				}));

		const templateDisplaySetting = new Setting(containerEl)
			.setName('Template Name Display')
			.addDropdown(dropdown => dropdown
				.addOption('template', 'Template name only')
				.addOption('result', 'Result only')
				.addOption('both', 'Both (Template → Result)')
				.setValue(this.settings.templateDisplayMode)
				.onChange(async (value: 'template' | 'result' | 'both') => {
					this.settings.templateDisplayMode = value;
					await this.saveSettings();
				}));

		// Display mode examples link
		const displayDescEl = templateDisplaySetting.descEl;
		displayDescEl.empty();
		displayDescEl.appendText('How template names are shown in context menus. Check ');
		
		const displayLinkEl = displayDescEl.createEl('a', {
			text: 'documentation',
			href: '#',
			cls: 'display-examples-link'
		});
		displayLinkEl.style.cssText = 'color: var(--text-accent); text-decoration: underline;';
		
		displayDescEl.appendText(' for examples.');
		
		// Handle examples link clicks
		displayLinkEl.addEventListener('click', (e) => {
			e.preventDefault();
			this.showDisplayExamples();
		});

		new Setting(containerEl)
			.setName('Template Menu Style')
			.setDesc('How templates appear in folder context menus.')
			.addDropdown(dropdown => dropdown
				.addOption('grouped', 'Grouped')
				.addOption('individual', 'Individual')
				.setValue(this.settings.templateMenuStyle)
				.onChange(async (value: 'grouped' | 'individual') => {
					this.settings.templateMenuStyle = value;
					await this.saveSettings();
					await this.onTemplateMenuStyleChange(value);
					this.display(); // Refresh to show/hide template list
				}));

		// Template management controls for individual mode
		if (this.settings.templateMenuStyle === 'individual') {
			this.addTemplateVisibilityControls(containerEl);
		}
	}

	// Show folder selection dropdown
	private showFolderSuggestions(inputEl: HTMLInputElement): void {
		// Remove any existing suggestions
		this.removeFolderSuggestions();

		// Get all folders in the vault
		const folders = this.getAllFolders();
		
		if (folders.length === 0) return;

		// Create suggestions dropdown
		const suggestionsEl = document.createElement('div');
		suggestionsEl.className = 'template-folder-suggestions';
		suggestionsEl.style.cssText = `
			position: absolute;
			top: 100%;
			left: 0;
			right: 0;
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			max-height: 200px;
			overflow-y: auto;
			z-index: 1000;
			box-shadow: 0 2px 8px rgba(0,0,0,0.15);
		`;

		// Add folder options
		folders.forEach(folder => {
			const optionEl = document.createElement('div');
			optionEl.className = 'template-folder-option';
			optionEl.textContent = folder.path;
			optionEl.style.cssText = `
				padding: 8px 12px;
				cursor: pointer;
				border-bottom: 1px solid var(--background-modifier-border-hover);
			`;
			
			optionEl.addEventListener('mouseenter', () => {
				optionEl.style.background = 'var(--background-modifier-hover)';
			});
			
			optionEl.addEventListener('mouseleave', () => {
				optionEl.style.background = '';
			});
			
			optionEl.addEventListener('click', () => {
				inputEl.value = folder.path;
				inputEl.dispatchEvent(new Event('input', { bubbles: true }));
				this.removeFolderSuggestions();
			});
			
			suggestionsEl.appendChild(optionEl);
		});

		// Position dropdown relative to input
		const inputContainer = inputEl.parentElement;
		if (inputContainer) {
			inputContainer.style.position = 'relative';
			inputContainer.appendChild(suggestionsEl);
		}

		// Close dropdown when clicking outside
		const closeHandler = (e: MouseEvent) => {
			if (!inputEl.contains(e.target as Node) && !suggestionsEl.contains(e.target as Node)) {
				this.removeFolderSuggestions();
				document.removeEventListener('click', closeHandler);
			}
		};
		
		setTimeout(() => {
			document.addEventListener('click', closeHandler);
		}, 0);
	}

	// Remove folder suggestions dropdown
	private removeFolderSuggestions(): void {
		const existing = document.querySelector('.template-folder-suggestions');
		if (existing) {
			existing.remove();
		}
	}

	// Get all folders in vault for suggestions
	private getAllFolders(): TFolder[] {
		const folders: TFolder[] = [];
		
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

		return folders.sort((a, b) => a.path.localeCompare(b.path));
	}

	// Add template visibility and ordering controls
	private async addTemplateVisibilityControls(containerEl: HTMLElement): Promise<void> {
		// Create header for template controls
		const headerSetting = new Setting(containerEl)
			.setName('Template Visibility')
			.setDesc('Control which templates appear in context menus and their order.');
		
		// Get current templates from folder
		const templates = await this.getTemplatesFromFolder();
		
		if (templates.length === 0) {
			new Setting(containerEl)
				.setDesc('No templates found in the selected folder.');
			return;
		}

		// Sync settings with current templates
		this.syncTemplateConfigs(templates);

		// Create list container
		const listContainer = containerEl.createDiv('template-visibility-list');
		listContainer.style.cssText = `
			border: 1px solid var(--background-modifier-border);
			border-radius: 6px;
			padding: 10px;
			margin-top: 10px;
			background: var(--background-secondary);
		`;

		// Sort templates by order
		const sortedConfigs = this.settings.templateConfigs
			.sort((a, b) => a.order - b.order);

		sortedConfigs.forEach((config, index) => {
			this.addTemplateControlItem(listContainer, config, index, templates);
		});
	}

	// Get templates from configured template folder
	private async getTemplatesFromFolder(): Promise<(TFile | TFolder)[]> {
		try {
			const templateFolder = this.app.vault.getAbstractFileByPath(this.settings.templateFolder);
			
			if (!templateFolder || !(templateFolder instanceof TFolder)) {
				return [];
			}

			const templates: (TFile | TFolder)[] = [];
			
			for (const child of templateFolder.children) {
				if (child instanceof TFile && child.extension === 'md') {
					templates.push(child);
				} else if (child instanceof TFolder && this.settings.enableFolderTemplates) {
					templates.push(child);
				}
			}

			return templates;
		} catch (error) {
			console.error('Error getting templates:', error);
			return [];
		}
	}

	// Sync template configs with current templates in folder
	private syncTemplateConfigs(currentTemplates: (TFile | TFolder)[]): void {
		const currentPaths = currentTemplates.map(t => t.path);
		
		// Remove configs for templates that no longer exist
		this.settings.templateConfigs = this.settings.templateConfigs
			.filter(config => currentPaths.includes(config.path));
		
		// Add configs for new templates
		currentTemplates.forEach((template, index) => {
			const existingConfig = this.settings.templateConfigs
				.find(config => config.path === template.path);
			
			if (!existingConfig) {
				this.settings.templateConfigs.push({
					path: template.path,
					visible: true,
					order: index
				});
			}
		});
	}

	// Add individual template control item with buttons
	private addTemplateControlItem(
		container: HTMLElement, 
		config: TemplateConfig, 
		index: number,
		allTemplates: (TFile | TFolder)[]
	): void {
		const template = allTemplates.find(t => t.path === config.path);
		if (!template) return;

		const itemEl = container.createDiv('template-control-item');
		itemEl.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 8px 12px;
			border-radius: 4px;
			margin-bottom: 4px;
			background: var(--background-primary);
			${config.visible ? '' : 'opacity: 0.5; color: var(--text-muted);'}
		`;

		// Template info (left side)
		const infoEl = itemEl.createDiv('template-info');
		infoEl.style.cssText = 'display: flex; align-items: center; flex: 1;';
		
		const nameEl = infoEl.createSpan('template-name');
		nameEl.textContent = template.name;

		// Controls (right side)
		const controlsEl = itemEl.createDiv('template-controls');
		controlsEl.style.cssText = 'display: flex; align-items: center; gap: 8px;';

		// Move up button
		const upBtn = controlsEl.createEl('button', { text: '↑' });
		upBtn.style.cssText = 'min-width: 24px; height: 24px;';
		upBtn.disabled = index === 0;
		upBtn.onclick = () => this.moveTemplate(config, -1);

		// Move down button  
		const downBtn = controlsEl.createEl('button', { text: '↓' });
		downBtn.style.cssText = 'min-width: 24px; height: 24px;';
		downBtn.disabled = index === this.settings.templateConfigs.length - 1;
		downBtn.onclick = () => this.moveTemplate(config, 1);

		// Hide/Show button
		const toggleBtn = controlsEl.createEl('button', { 
			text: config.visible ? 'Hide' : 'Show' 
		});
		toggleBtn.style.cssText = `
			min-width: 50px; 
			height: 24px;
			background: ${config.visible ? 'var(--interactive-accent)' : 'var(--background-modifier-border)'};
			color: ${config.visible ? 'white' : 'var(--text-muted)'};
		`;
		toggleBtn.onclick = () => this.toggleTemplateVisibility(config);
	}

	// Move template up or down in order
	private async moveTemplate(config: TemplateConfig, direction: number): Promise<void> {
		const currentIndex = this.settings.templateConfigs.findIndex(c => c.path === config.path);
		const newIndex = currentIndex + direction;
		
		if (newIndex < 0 || newIndex >= this.settings.templateConfigs.length) {
			return;
		}

		// Swap orders
		const otherConfig = this.settings.templateConfigs[newIndex];
		const tempOrder = config.order;
		config.order = otherConfig.order;
		otherConfig.order = tempOrder;

		await this.saveSettings();
		this.display(); // Refresh display
	}

	// Toggle template visibility in menus
	private async toggleTemplateVisibility(config: TemplateConfig): Promise<void> {
		config.visible = !config.visible;
		await this.saveSettings();
		this.display(); // Refresh display
	}

	// Show variables documentation modal
	private showVariablesDocumentation(): void {
		new VariablesDocModal(this.app).open();
	}

	// Show display mode examples modal
	private showDisplayExamples(): void {
		new DisplayExamplesModal(this.app).open();
	}

}

// Modal showing available template variables with copy buttons
class VariablesDocModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Set title
		this.setTitle('Template Variables Documentation');

		// Create content
		const variables = [
			'{{date}} - Current date (2025-08-30)',
			'{{dayName}} - Current day (Friday)',
			'{{year}} - Current year (2025)',
			'{{month}} - Current month (08)', 
			'{{day}} - Current day (30)',
			'{{time}} - Current time (14:30)',
			'{{hour}} - Current hour (14)',
			'{{minute}} - Current minute (30)',
			'{{weekDay1}} - Monday',
			'{{weekDay2}} - Tuesday',
			'{{weekDay3}} - Wednesday',
			'{{weekDay4}} - Thursday',
			'{{weekDay5}} - Friday',
			'{{weekDay6}} - Saturday',
			'{{weekDay7}} - Sunday',
			'{{uuid}} - Random UUID (a1b2c3d4-...)',
			'{{+Number}} - Auto-increment (01, 02, 03...)'
		];

		// Add variables list
		const listEl = contentEl.createDiv();
		listEl.style.cssText = 'font-family: monospace; font-size: 14px; line-height: 1.6;';
		
		variables.forEach(variable => {
			const itemEl = listEl.createDiv();
			itemEl.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 4px 8px; background: var(--background-secondary); border-radius: 4px;';
			
			const textEl = itemEl.createSpan();
			textEl.textContent = variable;
			
			const copyBtn = itemEl.createEl('button', { text: 'copy' });
			copyBtn.style.cssText = 'min-width: 40px; height: 24px; font-size: 11px; background: transparent; color: var(--text-muted); border: 1px solid var(--background-modifier-border); border-radius: 3px; cursor: pointer;';
			
			// Extract just the variable part ({{...}})
			const variableMatch = variable.match(/(\{\{[^}]+\}\})/);
			const variableOnly = variableMatch ? variableMatch[1] : variable;
			
			copyBtn.onclick = () => {
				navigator.clipboard.writeText(variableOnly).then(() => {
					copyBtn.textContent = '✓';
					copyBtn.style.color = 'var(--text-success)';
					setTimeout(() => {
						copyBtn.textContent = 'copy';
						copyBtn.style.color = 'var(--text-muted)';
					}, 1000);
				}).catch(() => {
					// Fallback for older browsers
					const textArea = document.createElement('textarea');
					textArea.value = variableOnly;
					document.body.appendChild(textArea);
					textArea.select();
					document.execCommand('copy');
					document.body.removeChild(textArea);
					
					copyBtn.textContent = '✓';
					copyBtn.style.color = 'var(--text-success)';
					setTimeout(() => {
						copyBtn.textContent = 'copy';
						copyBtn.style.color = 'var(--text-muted)';
					}, 1000);
				});
			};
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Modal showing template display mode examples
class DisplayExamplesModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Set title
		this.setTitle('Template Name Display Examples');

		// Create examples
		const examples = [
			{
				mode: 'Template name only',
				description: 'Shows the raw template name with variables',
				items: ['Week_{{+Number}}', 'Daily_{{date}}.md', '{{dayName}}_Meeting']
			},
			{
				mode: 'Result only',
				description: 'Shows only the processed result',
				items: ['Week_01', 'Daily_2025-08-30.md', 'Friday_Meeting']
			},
			{
				mode: 'Both (Template → Result)',
				description: 'Shows template name and result',
				items: ['Week_{{+Number}} → Week_01', 'Daily_{{date}}.md → Daily_2025-08-30.md', '{{dayName}}_Meeting → Friday_Meeting']
			}
		];

		examples.forEach((example, index) => {
			// Add section header
			const headerEl = contentEl.createEl('h3');
			headerEl.textContent = example.mode;
			headerEl.style.cssText = 'margin-top: 20px; margin-bottom: 8px; color: var(--text-accent);';
			if (index === 0) headerEl.style.marginTop = '0';

			// Add description
			const descEl = contentEl.createDiv();
			descEl.textContent = example.description;
			descEl.style.cssText = 'margin-bottom: 12px; color: var(--text-muted); font-style: italic;';

			// Add examples list
			const listEl = contentEl.createDiv();
			listEl.style.cssText = 'font-family: monospace; font-size: 14px; line-height: 1.6; margin-bottom: 16px;';
			
			example.items.forEach(item => {
				const itemEl = listEl.createDiv();
				itemEl.textContent = `• ${item}`;
				itemEl.style.cssText = 'margin-bottom: 4px; padding: 4px 8px; background: var(--background-secondary); border-radius: 4px;';
			});
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}