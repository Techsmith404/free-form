import { FormFieldDefinition, FormTemplate } from '../types/index.js';

export function generateMarkdownFromForm(
  template: FormTemplate,
  values: Record<string, any>
): string {
  const lines: string[] = [];

  // Frontmatter
  lines.push('---');
  lines.push(`template: "${template.name.replace(/"/g, '\\"')}"`);
  lines.push(`template_id: "${template.id}"`);
  lines.push(`generated_at: "${new Date().toISOString()}"`);
  lines.push('---');
  lines.push('');

  lines.push(`# ${template.name}`);
  if (template.description) {
    lines.push(`> ${template.description}`);
    lines.push('');
  }

  for (const field of template.fields_schema) {
    const val = values[field.id];

    if (field.type === 'header') {
      lines.push(`## ${field.label}`);
      if (field.description) {
        lines.push(`*${field.description}*`);
      }
      lines.push('');
      continue;
    }

    if (val === undefined || val === null || val === '') {
      continue;
    }

    switch (field.type) {
      case 'text': {
        lines.push(`**${field.label}**: ${val}`);
        lines.push('');
        break;
      }
      case 'textarea': {
        lines.push(`### ${field.label}`);
        lines.push(String(val));
        lines.push('');
        break;
      }
      case 'number': {
        const unitSuffix = field.unit ? ` ${field.unit}` : '';
        lines.push(`**${field.label}**: ${val}${unitSuffix}`);
        lines.push('');
        break;
      }
      case 'date':
      case 'time':
      case 'select': {
        lines.push(`**${field.label}**: ${val}`);
        lines.push('');
        break;
      }
      case 'checkbox': {
        const check = val ? '[x]' : '[ ]';
        lines.push(`- ${check} **${field.label}**`);
        lines.push('');
        break;
      }
      case 'rating': {
        const num = Number(val) || 0;
        const max = field.max || 5;
        const stars = '★'.repeat(Math.min(num, max)) + '☆'.repeat(Math.max(0, max - num));
        lines.push(`**${field.label}**: ${stars} (${num}/${max})`);
        lines.push('');
        break;
      }
      case 'table': {
        lines.push(`### ${field.label}`);
        if (Array.isArray(val) && val.length > 0 && field.columns && field.columns.length > 0) {
          const headers = field.columns.map((col) => col.name);
          const separators = field.columns.map(() => '---');
          lines.push(`| ${headers.join(' | ')} |`);
          lines.push(`| ${separators.join(' | ')} |`);

          for (const row of val) {
            const rowCells = field.columns.map((col) => {
              const cellVal = row[col.id];
              if (col.type === 'checkbox') {
                return cellVal ? '✓' : '✗';
              }
              return String(cellVal ?? '').replace(/\|/g, '\\|');
            });
            lines.push(`| ${rowCells.join(' | ')} |`);
          }
        } else {
          lines.push('*No rows recorded*');
        }
        lines.push('');
        break;
      }
      case 'signature': {
        lines.push(`### ${field.label}`);
        if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('/uploads') || val.startsWith('data:image'))) {
          lines.push(`![Signature](${val})`);
        } else {
          lines.push(`Signed: ${val}`);
        }
        lines.push('');
        break;
      }
      case 'image': {
        lines.push(`### ${field.label}`);
        if (typeof val === 'string') {
          lines.push(`![Image](${val})`);
        }
        lines.push('');
        break;
      }
      default: {
        lines.push(`**${field.label}**: ${JSON.stringify(val)}`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}
