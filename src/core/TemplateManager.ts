import { App, TFile, TFolder, Notice, Menu } from 'obsidian';
import { TemplaterDirSettings } from '../types/settings';
import { TemplateProcessor } from './TemplateProcessor';
import { validateFileName } from '../utils/validation';
import { TemplateSelectorModal } from '../ui/TemplateSelectorModal';

// Manages template operations and context menu integration
export class TemplateManager {
	private processor: TemplateProcessor;
	private cachedTemplates: (TFile | TFolder)[] | null = null;

	constructor(
		private app: App,
		private settings: TemplaterDirSettings
	) {
		this.processor = new TemplateProcessor(settings);
	}

	// Initialize template cache for individual menu mode
	async initializeCache(): Promise<void> {
		if (this.settings.templateMenuStyle === 'individual') {
			try {
				this.cachedTemplates = await this.getTemplates();
				console.log('Cached templates:', this.cachedTemplates);
			} catch (error) {
				console.error('Failed to cache templates:', error);
			}
		}
	}

	// Update cached templates when settings change
	async updateCache(): Promise<void> {
		if (this.settings.templateMenuStyle === 'individual') {
			try {
				this.cachedTemplates = await this.getTemplates();
				console.log('Updated cached templates:', this.cachedTemplates);
			} catch (error) {
				console.error('Failed to update cached templates:', error);
			}
		} else {
			this.cachedTemplates = null;
		}
	}

	// Add template options to folder context menu
	addTemplateContextMenu(menu: Menu, folder: TFolder): void {
		console.log('Template menu style:', this.settings.templateMenuStyle);
		if (this.settings.templateMenuStyle === 'grouped') {
			// Grouped mode: single menu item with modal selector
			menu.addItem((item) => {
				item
					.setTitle('Create from template')
					.setIcon('file-plus')
					.onClick(() => {
						this.showTemplateSelector(folder);
					});
			});
		} else {
			// Individual mode: separate menu item for each template
			const allTemplates = this.cachedTemplates;
			const templates = this.filterAndSortTemplates(allTemplates || []);
			console.log('Using cached templates:', templates);
			
			if (!templates || templates.length === 0) {
				menu.addItem((item) => {
					item
						.setTitle('No templates found')
						.setIcon('file-x')
						.setDisabled(true);
				});
				return;
			}

			for (const template of templates) {
				const icon = template instanceof TFolder ? 'folder' : 'file-text';
				
				// Get preview of what the final name will be
				const previewName = this.processor.getPreviewName(template.name, folder);
				const validation = validateFileName(previewName);
				
				// Create title based on display mode
				let title: string;
				switch (this.settings.templateDisplayMode) {
					case 'template':
						title = template.name;
						break;
					case 'result':
						title = previewName;
						break;
					case 'both':
					default:
						if (previewName === template.name) {
							// No variables to process, just show the name
							title = template.name;
						} else {
							// Show both template name and preview
							title = `${template.name} → ${previewName}`;
						}
						break;
				}
				
				// Add warning if invalid
				if (!validation.valid) {
					title += ` (Invalid)`;
				}
				
				console.log(`Adding menu item: ${title}, icon: ${icon}`);
				
				menu.addItem((item) => {
					console.log('Creating menu item for:', template.name);
					item
						.setTitle(title)
						.setIcon(icon);
					
					// Disable if validation fails
					if (!validation.valid) {
						item.setDisabled(true);
					} else {
						item.onClick(() => {
							console.log('Clicked on template:', template.name);
							if (template instanceof TFile) {
								this.createFileFromTemplate(template, folder);
							} else if (template instanceof TFolder) {
								this.createFolderFromTemplate(template, folder);
							}
						});
					}
				});
			}
		}
	}

	// Show template selection modal (grouped mode)
	async showTemplateSelector(targetFolder: TFolder): Promise<void> {
		try {
			const templates = await this.getTemplates();
			
			if (templates.length === 0) {
				new Notice('No templates found in the template folder');
				return;
			}

			new TemplateSelectorModal(this.app, templates, (selectedTemplate) => {
				if (selectedTemplate instanceof TFile) {
					this.createFileFromTemplate(selectedTemplate, targetFolder);
				} else if (selectedTemplate instanceof TFolder) {
					this.createFolderFromTemplate(selectedTemplate, targetFolder);
				}
			}).open();
			
		} catch (error) {
			console.error('Error loading templates:', error);
			new Notice('Error loading templates. Check console for details.');
		}
	}

	// Create file from template with variable processing
	async createFileFromTemplate(templateFile: TFile, targetFolder: TFolder): Promise<void> {
		try {
			// Read template content
			const templateContent = await this.app.vault.read(templateFile);
			const processedContent = this.processor.processVariables(templateContent, targetFolder);
			
			// Process variables in file name (no automatic timestamp)
			let newFileName = this.processor.processVariables(templateFile.name, targetFolder);
			
			// If no variables were processed, use original name
			if (newFileName === templateFile.name) {
				newFileName = templateFile.name;
			}
			
			// Validate file name
			const validation = validateFileName(newFileName);
			if (!validation.valid) {
				new Notice(`Cannot create file: ${validation.error}`);
				return;
			}
			
			const newFilePath = `${targetFolder.path}/${newFileName}`;
			
			// Create the new file
			const newFile = await this.app.vault.create(newFilePath, processedContent);
			
			// Open the new file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(newFile);
			
			new Notice(`Created: ${newFileName}`);
			
		} catch (error) {
			console.error('Error creating file from template:', error);
			new Notice('Error creating file. Check console for details.');
		}
	}

	// Create folder structure from template
	async createFolderFromTemplate(templateFolder: TFolder, targetFolder: TFolder): Promise<void> {
		try {
			// Process variables in folder name (including {{+Number}})
			let newFolderName = this.processor.processVariables(templateFolder.name, targetFolder);
			
			
			// Validate folder name
			const validation = validateFileName(newFolderName);
			if (!validation.valid) {
				new Notice(`Cannot create folder: ${validation.error}`);
				return;
			}
			
			console.log('Creating folder with name:', newFolderName);
			const newFolderPath = `${targetFolder.path}/${newFolderName}`;
			
			// Create the new folder
			const newFolder = await this.app.vault.createFolder(newFolderPath);
			
			// Copy all contents recursively
			await this.copyFolderContents(templateFolder, newFolder);
			
			new Notice(`Created folder: ${newFolderName}`);
			
		} catch (error) {
			console.error('Error creating folder from template:', error);
			new Notice('Error creating folder. Check console for details.');
		}
	}

	// Recursively copy folder contents with variable processing
	private async copyFolderContents(sourceFolder: TFolder, targetFolder: TFolder): Promise<void> {
		for (const child of sourceFolder.children) {
			if (child instanceof TFile) {
				// Copy file with variable replacement
				const content = await this.app.vault.read(child);
				const processedContent = this.processor.processVariables(content, targetFolder);
				const newFileName = this.processor.processVariables(child.name, targetFolder);
				
				// Validate file name
				const validation = validateFileName(newFileName);
				if (!validation.valid) {
					console.warn(`Skipping file creation: ${validation.error} - ${newFileName}`);
					new Notice(`Skipped file "${child.name}": ${validation.error}`);
					return;
				}
				
				await this.app.vault.create(`${targetFolder.path}/${newFileName}`, processedContent);
			} else if (child instanceof TFolder) {
				// Recursively copy subfolder with variable replacement
				const newFolderName = this.processor.processVariables(child.name, targetFolder);
				const newSubfolder = await this.app.vault.createFolder(`${targetFolder.path}/${newFolderName}`);
				await this.copyFolderContents(child, newSubfolder);
			}
		}
	}

	// Get all available templates from template folder
	async getTemplates(): Promise<(TFile | TFolder)[]> {
		const templateFolder = this.app.vault.getAbstractFileByPath(this.settings.templateFolder);
		
		if (!templateFolder || !(templateFolder instanceof TFolder)) {
			throw new Error(`Template folder "${this.settings.templateFolder}" not found`);
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
	}

	// Filter visible templates and sort by order
	private filterAndSortTemplates(allTemplates: (TFile | TFolder)[]): (TFile | TFolder)[] {
		// Get template configs for filtering and sorting
		const configs = this.settings.templateConfigs;
		
		if (configs.length === 0) {
			// No configs yet, return all templates as visible
			return allTemplates;
		}

		// Filter visible templates and sort by order
		const visibleConfigs = configs
			.filter(config => config.visible)
			.sort((a, b) => a.order - b.order);

		// Map configs back to actual template objects
		const sortedTemplates: (TFile | TFolder)[] = [];
		
		visibleConfigs.forEach(config => {
			const template = allTemplates.find(t => t.path === config.path);
			if (template) {
				sortedTemplates.push(template);
			}
		});

		return sortedTemplates;
	}
}