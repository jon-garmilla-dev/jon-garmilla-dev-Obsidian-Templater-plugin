import { TFolder } from 'obsidian';
import { TemplaterDirSettings } from '../types/settings';
import { escapeRegExp } from '../utils/validation';

// Processes template variables
export class TemplateProcessor {
	constructor(private settings: TemplaterDirSettings) {}
	
	// Generate simple UUID v4
	private generateUUID(): string {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			const r = Math.random() * 16 | 0;
			const v = c == 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}

	// Process variables in text
	processVariables(text: string, targetFolder: TFolder): string {
		if (!this.settings.dateVariables) {
			return text;
		}
		
		const now = new Date();
		const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD
		const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		const dayName = dayNames[now.getDay()];
		
		// Time variables
		const timeString = now.toTimeString().slice(0, 5); // HH:MM
		const hour = now.getHours().toString().padStart(2, '0');
		const minute = now.getMinutes().toString().padStart(2, '0');
		
		console.log('Processing variables for text:', text);
		
		
		let result = text
			.replace(/\{\{date\}\}/g, dateString)
			.replace(/\{\{dayName\}\}/g, dayName)
			.replace(/\{\{year\}\}/g, now.getFullYear().toString())
			.replace(/\{\{month\}\}/g, (now.getMonth() + 1).toString().padStart(2, '0'))
			.replace(/\{\{day\}\}/g, now.getDate().toString().padStart(2, '0'))
			.replace(/\{\{time\}\}/g, timeString)
			.replace(/\{\{hour\}\}/g, hour)
			.replace(/\{\{minute\}\}/g, minute)
			.replace(/\{\{uuid\}\}/g, () => this.generateUUID());

		// Week day variables (Monday = 1, Sunday = 7)
		for (let i = 1; i <= 7; i++) {
			const weekDayIndex = i === 7 ? 0 : i; // Sunday is 0, Monday is 1, etc.
			result = result.replace(new RegExp(`\\{\\{weekDay${i}\\}\\}`, 'g'), dayNames[weekDayIndex]);
		}

		console.log('After date/day variables:', result);

		// Handle {{+Number}} auto-increment after other variables
		if (result.includes('{{+Number}}')) {
			const incrementNumber = this.getAutoIncrementNumber(result, targetFolder);
			result = result.replace(/\{\{\+Number\}\}/g, incrementNumber);
		}

		console.log('Final result:', result);
		return result;
	}

	// Get next auto-increment number
	getAutoIncrementNumber(baseName: string, targetFolder: TFolder): string {
		// Remove {{+Number}} to get base name
		const cleanBaseName = baseName.replace(/\{\{\+Number\}\}/g, '');
		
		const existingItems = targetFolder.children
			.map(child => child.name);
		
		// Find existing numbered items
		const numberedPattern = new RegExp(`^${escapeRegExp(cleanBaseName)}(\\d{2})(.*)$`);
		const existingNumbers = existingItems
			.map(name => {
				const match = name.match(numberedPattern);
				return match ? parseInt(match[1], 10) : 0;
			})
			.filter(num => num > 0);
		
		// Get next number
		const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
		
		return nextNumber.toString().padStart(2, '0');
	}

	// Get preview of processed template name
	getPreviewName(templateName: string, targetFolder: TFolder): string {
		try {
			return this.processVariables(templateName, targetFolder);
		} catch (error) {
			return `[Error: ${error.message}]`;
		}
	}

}