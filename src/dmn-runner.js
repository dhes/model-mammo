import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { XMLParser } from 'fast-xml-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dmnPath = resolve(__dirname, '../mammo.dmn');

let parsedDecision = null;

/**
 * Ensure text is a string (XML parser may return objects for mixed content)
 */
function getText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && '#text' in value) return value['#text'];
  return String(value);
}

/**
 * Parse a FEEL unary test expression
 */
function parseUnaryTest(textValue, inputType) {
  let text = getText(textValue);
  if (!text || text === '-' || text.trim() === '') {
    return () => true; // match any
  }

  text = text.trim();

  // String literal: "value"
  if (text.startsWith('"') && text.endsWith('"')) {
    const value = text.slice(1, -1);
    return (input) => input === value;
  }

  // Boolean literal
  if (text === 'true') return (input) => input === true;
  if (text === 'false') return (input) => input === false;

  // Range: [min..max]
  const rangeMatch = text.match(/^\[(\d+)\.\.(\d+)\]$/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    return (input) => input >= min && input <= max;
  }

  // Comparison: <n, >n, <=n, >=n
  const compMatch = text.match(/^([<>]=?)(\d+)$/);
  if (compMatch) {
    const op = compMatch[1];
    const num = parseInt(compMatch[2], 10);
    switch (op) {
      case '<': return (input) => input < num;
      case '>': return (input) => input > num;
      case '<=': return (input) => input <= num;
      case '>=': return (input) => input >= num;
    }
  }

  // Number literal
  if (/^\d+$/.test(text)) {
    const num = parseInt(text, 10);
    return (input) => input === num;
  }

  throw new Error(`Unsupported FEEL expression: ${text}`);
}

/**
 * Parse output expression to get literal value
 */
function parseOutputExpression(textValue) {
  let text = getText(textValue);
  if (!text) return null;
  text = text.trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1);
  }
  if (/^\d+$/.test(text)) {
    return parseInt(text, 10);
  }
  return text;
}

/**
 * Load and parse the DMN file
 */
export function loadDMN() {
  if (parsedDecision) return parsedDecision;

  const dmnXml = readFileSync(dmnPath, 'utf-8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  const doc = parser.parse(dmnXml);
  const definitions = doc.definitions;
  const decision = definitions.decision;
  const decisionTable = decision.decisionTable;

  // Parse inputs
  const inputs = Array.isArray(decisionTable.input)
    ? decisionTable.input
    : [decisionTable.input];

  const inputDefs = inputs.map(inp => ({
    id: inp['@_id'],
    label: inp['@_label'],
    name: inp.inputExpression.text,
    type: inp.inputExpression['@_typeRef'],
  }));

  // Parse output
  const output = decisionTable.output;
  const outputDef = {
    id: output['@_id'],
    name: output['@_name'],
    type: output['@_typeRef'],
  };

  // Parse rules
  const rules = Array.isArray(decisionTable.rule)
    ? decisionTable.rule
    : [decisionTable.rule];

  const ruleDefs = rules.map(rule => {
    const inputEntries = Array.isArray(rule.inputEntry)
      ? rule.inputEntry
      : [rule.inputEntry];

    const conditions = inputEntries.map((entry, idx) => ({
      inputName: inputDefs[idx].name,
      test: parseUnaryTest(entry.text, inputDefs[idx].type),
    }));

    const outputEntry = rule.outputEntry;
    const outputValue = parseOutputExpression(outputEntry.text);

    return { conditions, outputValue };
  });

  parsedDecision = {
    inputs: inputDefs,
    output: outputDef,
    rules: ruleDefs,
  };

  return parsedDecision;
}

/**
 * Evaluate the decision table with given inputs
 */
export function evaluateDecision(inputs) {
  const decision = loadDMN();

  // First match hit policy (default for this decision table)
  for (const rule of decision.rules) {
    let allMatch = true;
    for (const condition of rule.conditions) {
      const inputValue = inputs[condition.inputName];
      if (!condition.test(inputValue)) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) {
      return { [decision.output.name]: rule.outputValue };
    }
  }

  // No rule matched
  return { [decision.output.name]: null };
}
