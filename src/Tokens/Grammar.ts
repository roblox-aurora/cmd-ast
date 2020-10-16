const Grammar = {
	Operators: ["&", "|", "=", ">", "<", "-", "+", "/", "*", "!"],
	UnaryOperators: ["!"],
	EndOfStatement: [";", "\n"],
	Punctuation: ["(", ")", ",", "{", "}", "[", "]", ".", ":", "\\"],
	BooleanLiterals: ["true", "false"],
	Keywords: ["if", "else", "for", "in", "function"],
	Types: ["number", "string", "boolean"],
	OperatorPrecedence: identity<Record<string, number>>({
		"!": 1,
		"=": 1,
		"+=": 1,
		"-=": 1,
		"|": 2,
		"||": 2,
		"&&": 3,
		"<": 7,
		">": 7,
		">=": 7,
		"<=": 7,
		"==": 7,
		"!=": 7,
		"+": 10,
		"-": 10,
		"*": 20,
		"/": 20,
		"%": 20,
	}),
} as const;

export type OperatorTokens = typeof Grammar["Operators"][number];
export type EndOfStatementTokens = typeof Grammar["EndOfStatement"][number];
export type PunctuationTokens = typeof Grammar["Punctuation"][number];
export type BooleanLiteralTokens = typeof Grammar["BooleanLiterals"][number];
export type UnaryOperatorsTokens = typeof Grammar["UnaryOperators"][number];

export default Grammar;
