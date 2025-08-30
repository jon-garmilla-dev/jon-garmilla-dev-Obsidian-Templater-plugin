import { Notice, Plugin, TFolder } from 'obsidian';
import { TemplaterDirSettings, DEFAULT_SETTINGS } from './src/types/settings';
import { TemplateManager } from './src/core/TemplateManager';
import { TemplaterDirSettingTab } from './src/ui/SettingsTab';

// Main plugin class for Templater Dir
export default class TemplaterDirPlugin extends Plugin {
	settings: TemplaterDirSettings;
	templateManager: TemplateManager;
	private cacheUpdateTimeout: number;

	// Initialize plugin on load
	async onload() {
		await this.loadSettings();
		
		// Initialize template manager
		this.templateManager = new TemplateManager(this.app, this.settings);
		await this.templateManager.initializeCache();

		// Add settings tab
		this.addSettingTab(new TemplaterDirSettingTab(
			this.app, 
			this, 
			this.settings, 
			() => this.saveSettings(),
			(value) => this.onTemplateMenuStyleChange(value)
		));

		// Register context menu for folders
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFolder) {
					this.templateManager.addTemplateContextMenu(menu, file);
				}
			})
		);

		// Listen for changes in the vault to update template cache
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				this.onFileChange();
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				this.onFileChange();
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				this.onFileChange();
			})
		);

		// Setup plugin commands
		this.setupCommands();
	}

	// Load plugin settings from data
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	// Save plugin settings to data
	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Handle template menu style changes
	private async onTemplateMenuStyleChange(value: 'grouped' | 'individual') {
		this.settings.templateMenuStyle = value;
		await this.saveSettings();
		await this.templateManager.updateCache();
	}

	// Handle vault file changes for cache updates
	private onFileChange() {
		// Only update cache if we're using individual mode
		if (this.settings.templateMenuStyle === 'individual') {
			// Use a small delay to avoid excessive updates during bulk operations
			clearTimeout(this.cacheUpdateTimeout);
			this.cacheUpdateTimeout = window.setTimeout(async () => {
				await this.templateManager.updateCache();
				console.log('Template cache updated due to file changes');
			}, 500);
		}
	}


	// Register plugin commands
	private setupCommands() {
		// Add any custom commands here if needed
		this.addCommand({
			id: 'refresh-template-cache',
			name: 'Refresh template cache',
			callback: () => {
				this.templateManager.updateCache();
				new Notice('Template cache refreshed');
			}
		});
	}

	// Clean up on plugin unload
	onunload() {
		// Clear any pending cache updates
		if (this.cacheUpdateTimeout) {
			clearTimeout(this.cacheUpdateTimeout);
		}
	}
}