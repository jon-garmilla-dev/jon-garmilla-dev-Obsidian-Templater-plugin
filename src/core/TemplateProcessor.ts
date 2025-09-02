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

		let result = text;

		// Handle {{+Number}} auto-increment FIRST.
		// This ensures the number is calculated based on the template's structure,
		// not the content of other variables like {{dayName}}.
		if (result.includes('{{+Number}}')) {
			const incrementNumber = this.getAutoIncrementNumber(result, targetFolder);
			result = result.replace(/\{\{\+Number\}\}/g, incrementNumber);
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
		
		result = result
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

		console.log('Final result:', result);
		return result;
	}

	// Get next auto-increment number
	getAutoIncrementNumber(template: string, targetFolder: TFolder): string {
		// Split the template by the {{+Number}} token to isolate the parts of the filename.
		const parts = template.split(/\{\{\+Number\}\}/g);
		
		// Process each part to build a safe and correct regex segment.
		const regexParts = parts.map(part => {
			// First, escape the entire part to handle any special regex characters literally.
			let escapedPart = escapeRegExp(part);
			
			// Find all {{...}} variables within the original, unescaped part.
			const variableRegex = /\{\{.*?\}\}/g;
			let match;
			while ((match = variableRegex.exec(part)) !== null) {
				// Escape the variable token itself (e.g., '{{dayName}}' becomes '\{\{dayName\}\}').
				const escapedToken = escapeRegExp(match[0]);
				// In the already-escaped string, replace the escaped token with a wildcard.
				// This ensures that wildcards are not themselves escaped.
				escapedPart = escapedPart.replace(escapedToken, '.*');
			}
			return escapedPart;
		});

		// Join the processed parts with the number-capturing group '(\d+)'.
		const patternString = `^${regexParts.join('(\\d+)')}$`;
		const numberedPattern = new RegExp(patternString);

		const existingItems = targetFolder.children.map(child => child.name);
		
		const existingNumbers = existingItems
			.map(name => {
				const match = name.match(numberedPattern);
				// The number is in the first capturing group (match[1]).
				return match && match[1] ? parseInt(match[1], 10) : 0;
			})
			.filter(num => num > 0);
		
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
