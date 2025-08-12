import { Injectable, Logger } from '@nestjs/common';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
  score: number; // 0-100
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  specialChars: string;
  preventCommonPasswords: boolean;
  preventPersonalInfo: boolean;
  maxRepeatingChars: number;
  preventSequences: boolean;
}

@Injectable()
export class PasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);

  private readonly defaultPolicy: PasswordPolicy = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '@$!%*?&',
    preventCommonPasswords: true,
    preventPersonalInfo: true,
    maxRepeatingChars: 3,
    preventSequences: true,
  };

  // Lista de contraseñas comunes bloqueadas
  private readonly commonPasswords = [
    'password', 'password123', '123456', '123456789', 'qwerty', 'abc123',
    'password1', 'admin', 'administrador', 'minoil', 'minoil123', 'welcome',
    'welcome123', 'changeme', 'letmein', 'master', 'secret', 'superman',
    'batman', 'dragon', 'monkey', 'computer', 'internet', 'service'
  ];

  // Secuencias comunes
  private readonly sequences = [
    '123456', '654321', 'qwerty', 'asdfgh', 'zxcvbn', 'abcdef', 'fedcba'
  ];

  /**
   * Valida una contraseña contra la política de seguridad
   */
  validatePassword(
    password: string, 
    userInfo?: { username?: string; nombre?: string; apellido?: string; email?: string },
    customPolicy?: Partial<PasswordPolicy>
  ): PasswordValidationResult {
    const policy = { ...this.defaultPolicy, ...customPolicy };
    const errors: string[] = [];
    let score = 0;

    // 1. Validación de longitud
    if (password.length < policy.minLength) {
      errors.push(`La contraseña debe tener al menos ${policy.minLength} caracteres`);
    } else {
      score += Math.min(20, (password.length - policy.minLength + 1) * 2);
    }

    if (password.length > policy.maxLength) {
      errors.push(`La contraseña no puede tener más de ${policy.maxLength} caracteres`);
    }

    // 2. Validación de caracteres requeridos
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('La contraseña debe contener al menos una letra mayúscula');
    } else if (/[A-Z]/.test(password)) {
      score += 15;
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('La contraseña debe contener al menos una letra minúscula');
    } else if (/[a-z]/.test(password)) {
      score += 15;
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('La contraseña debe contener al menos un número');
    } else if (/\d/.test(password)) {
      score += 15;
    }

    if (policy.requireSpecialChars) {
      const specialCharsRegex = new RegExp(`[${policy.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
      if (!specialCharsRegex.test(password)) {
        errors.push(`La contraseña debe contener al menos un carácter especial (${policy.specialChars})`);
      } else {
        score += 20;
      }
    }

    // 3. Validación de contraseñas comunes
    if (policy.preventCommonPasswords) {
      const lowercasePassword = password.toLowerCase();
      const isCommon = this.commonPasswords.some(common => 
        lowercasePassword.includes(common) || common.includes(lowercasePassword)
      );
      if (isCommon) {
        errors.push('La contraseña no puede contener palabras comunes');
        score -= 30;
      }
    }

    // 4. Validación de información personal
    if (policy.preventPersonalInfo && userInfo) {
      const personalData = [
        userInfo.username?.toLowerCase(),
        userInfo.nombre?.toLowerCase(),
        userInfo.apellido?.toLowerCase(),
        userInfo.email?.split('@')[0]?.toLowerCase()
      ].filter(Boolean);

      const lowercasePassword = password.toLowerCase();
      for (const data of personalData) {
        if (data && data.length > 2 && lowercasePassword.includes(data)) {
          errors.push('La contraseña no puede contener información personal (nombre, apellido, username)');
          score -= 25;
          break;
        }
      }
    }

    // 5. Validación de caracteres repetidos
    if (policy.maxRepeatingChars > 0) {
      const repeatingPattern = new RegExp(`(.)\\1{${policy.maxRepeatingChars},}`);
      if (repeatingPattern.test(password)) {
        errors.push(`La contraseña no puede tener más de ${policy.maxRepeatingChars} caracteres consecutivos iguales`);
        score -= 15;
      }
    }

    // 6. Validación de secuencias
    if (policy.preventSequences) {
      const lowercasePassword = password.toLowerCase();
      const hasSequence = this.sequences.some(seq => 
        lowercasePassword.includes(seq) || lowercasePassword.includes(seq.split('').reverse().join(''))
      );
      if (hasSequence) {
        errors.push('La contraseña no puede contener secuencias comunes (123456, qwerty, etc.)');
        score -= 20;
      }
    }

    // 7. Bonificaciones por diversidad
    const uniqueChars = new Set(password).size;
    score += Math.min(15, uniqueChars);

    // Normalizar score
    score = Math.max(0, Math.min(100, score));

    // Determinar fuerza
    let strength: 'weak' | 'fair' | 'good' | 'strong';
    if (score < 30) strength = 'weak';
    else if (score < 50) strength = 'fair';
    else if (score < 80) strength = 'good';
    else strength = 'strong';

    const result: PasswordValidationResult = {
      isValid: errors.length === 0,
      errors,
      strength,
      score
    };

    this.logger.debug(`Validación de contraseña completada:`, {
      isValid: result.isValid,
      strength: result.strength,
      score: result.score,
      errorsCount: errors.length
    });

    return result;
  }

  /**
   * Genera sugerencias para mejorar una contraseña
   */
  generatePasswordSuggestions(validationResult: PasswordValidationResult): string[] {
    const suggestions: string[] = [];

    if (validationResult.strength === 'weak') {
      suggestions.push('Aumente la longitud de la contraseña a al menos 12 caracteres');
      suggestions.push('Combine letras mayúsculas, minúsculas, números y símbolos');
      suggestions.push('Evite palabras comunes o información personal');
    }

    if (validationResult.strength === 'fair') {
      suggestions.push('Agregue más variedad de caracteres');
      suggestions.push('Evite patrones predecibles o secuencias');
    }

    if (validationResult.strength === 'good') {
      suggestions.push('Considere usar una passphrase con palabras no relacionadas');
      suggestions.push('Agregue algunos caracteres más para mayor seguridad');
    }

    suggestions.push('Use un gestor de contraseñas para generar y almacenar contraseñas seguras');
    suggestions.push('Cambie su contraseña regularmente (cada 90-180 días)');

    return suggestions;
  }

  /**
   * Valida la política de empresa para Minoil
   */
  getMinoilPasswordPolicy(): PasswordPolicy {
    return {
      ...this.defaultPolicy,
      // Política permisiva solicitada:
      // - Mínimo 8 caracteres
      // - Al menos 1 mayúscula
      // - Al menos 1 número
      // - Sin otras restricciones
      minLength: 8,
      requireUppercase: true,
      requireNumbers: true,
      requireLowercase: false,
      requireSpecialChars: false,
      preventCommonPasswords: false,
      preventPersonalInfo: false,
      maxRepeatingChars: 0,
      preventSequences: false,
    };
  }
}