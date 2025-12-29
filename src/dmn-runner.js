import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { XMLParser } from 'fast-xml-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultDmnPath = resolve(__dirname, '../input/dmn/BreastCancerScreening.dmn');

// Cache parsed decisions by file path
const parsedDecisions = new Map();

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
 * Parse a single FEEL value (used for disjunctions)
 */
function parseSingleValue(text) {
  text = text.trim();

  // String literal: "value"
  if (text.startsWith('"') && text.endsWith('"')) {
    return { type: 'string', value: text.slice(1, -1) };
  }

  // null literal
  if (text === 'null') {
    return { type: 'null', value: null };
  }

  // Boolean literal
  if (text === 'true') return { type: 'boolean', value: true };
  if (text === 'false') return { type: 'boolean', value: false };

  // Number literal
  if (/^-?\d+$/.test(text)) {
    return { type: 'number', value: parseInt(text, 10) };
  }

  return null;
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

  // null literal - matches null/undefined input
  if (text === 'null') {
    return (input) => input === null || input === undefined;
  }

  // Disjunction: "value1", "value2" (comma-separated values)
  if (text.includes(',')) {
    const parts = text.split(',').map(p => p.trim());
    const values = parts.map(p => parseSingleValue(p)).filter(v => v !== null);
    if (values.length === parts.length) {
      return (input) => values.some(v => {
        if (v.type === 'null') return input === null || input === undefined;
        return input === v.value;
      });
    }
  }

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
 * Load and parse a DMN file
 * @param {string} dmnPath - Path to DMN file (defaults to mammo.dmn)
 */
export function loadDMN(dmnPath = defaultDmnPath) {
  // Check cache
  if (parsedDecisions.has(dmnPath)) {
    return parsedDecisions.get(dmnPath);
  }

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
    name: getText(inp.inputExpression.text),
    type: inp.inputExpression['@_typeRef'],
  }));

  // Parse outputs (handle single or multiple)
  const outputs = Array.isArray(decisionTable.output)
    ? decisionTable.output
    : [decisionTable.output];

  const outputDefs = outputs.map(out => ({
    id: out['@_id'],
    name: out['@_name'],
    type: out['@_typeRef'],
  }));

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

    // Handle multiple outputs
    const outputEntries = Array.isArray(rule.outputEntry)
      ? rule.outputEntry
      : [rule.outputEntry];

    const outputValues = outputEntries.map((entry, idx) => ({
      name: outputDefs[idx].name,
      value: parseOutputExpression(entry.text),
    }));

    return { conditions, outputValues };
  });

  const parsedDecision = {
    inputs: inputDefs,
    outputs: outputDefs,
    rules: ruleDefs,
  };

  // Cache it
  parsedDecisions.set(dmnPath, parsedDecision);

  return parsedDecision;
}

/**
 * Evaluate the decision table with given inputs
 * @param {Object} inputs - Input values keyed by input name
 * @param {string} dmnPath - Path to DMN file (defaults to mammo.dmn)
 */
export function evaluateDecision(inputs, dmnPath = defaultDmnPath) {
  const decision = loadDMN(dmnPath);

  // First match hit policy (Unique also uses first match)
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
      // Build result from all outputs
      const result = {};
      for (const output of rule.outputValues) {
        result[output.name] = output.value;
      }
      return result;
    }
  }

  // No rule matched - return null for all outputs
  const result = {};
  for (const output of decision.outputs) {
    result[output.name] = null;
  }
  return result;
}
