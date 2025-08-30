// Result of file name validation
export interface ValidationResult {
	valid: boolean;
	error?: string;
}

// Validate file/folder names for cross-platform compatibility
export function validateFileName(name: string): ValidationResult {
	// Check for illegal characters
	const illegalChars = /[<>:"|?*\\/]/;
	if (illegalChars.test(name)) {
		return { valid: false, error: 'Contains illegal characters: < > : " | ? * \\ /' };
	}
	
	// Check for empty name
	if (!name.trim()) {
		return { valid: false, error: 'Name cannot be empty' };
	}
	
	// Check for reserved names (Windows)
	const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
	const baseName = name.split('.')[0].toUpperCase();
	if (reservedNames.includes(baseName)) {
		return { valid: false, error: `"${baseName}" is a reserved name` };
	}
	
	return { valid: true };
}

// Escape special regex characters in strings
export function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}