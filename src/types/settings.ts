// Template configuration for visibility and ordering
export interface TemplateConfig {
	path: string;
	visible: boolean;
	order: number;
}

// Main plugin settings
export interface TemplaterDirSettings {
	templateFolder: string;
	enableFolderTemplates: boolean;
	dateVariables: boolean;
	templateMenuStyle: 'grouped' | 'individual';
	templateConfigs: TemplateConfig[];
	templateDisplayMode: 'template' | 'result' | 'both';
}

// Default plugin settings
export const DEFAULT_SETTINGS: TemplaterDirSettings = {
	templateFolder: 'Templates',
	enableFolderTemplates: true,
	dateVariables: true,
	templateMenuStyle: 'grouped',
	templateConfigs: [],
	templateDisplayMode: 'both'
}