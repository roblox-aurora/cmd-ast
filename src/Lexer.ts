import ZrTextStream from "TextStream";
import Grammar, { BooleanLiteralTokens, EndOfStatementTokens, OperatorTokens, PunctuationTokens } from "Tokens/Grammar";
import {
	BooleanToken,
	EndOfStatementToken,
	IdentifierToken,
	InterpolatedStringToken,
	joinInterpolatedString,
	KeywordToken,
	NumberToken,
	OperatorToken,
	OptionToken,
	PropertyAccessToken,
	SpecialToken,
	StringToken,
	Token,
	ZrTokenKind,
} from "Tokens/Tokens";

const enum TokenCharacter {
	Hash = "#",
	Dollar = "$",
	DoubleQuote = '"',
	SingleQuote = "'",
	Dot = ".",
	Dash = "-",
}

export interface LexerOptions {
	readonly dud?: never;
}

/**
 * The lexer for Zirconium
 */
export default class ZrLexer {
	private static readonly OPERATORS = Grammar.Operators;
	private static readonly ENDOFSTATEMENT = Grammar.EndOfStatement;
	private static readonly SPECIAL = Grammar.Punctuation;
	private static readonly BOOLEAN = Grammar.BooleanLiterals;

	public constructor(private stream: ZrTextStream) {}

	private isNumeric = (c: string) => c.match("[%d._]")[0] !== undefined;
	private isSpecial = (c: string) => ZrLexer.SPECIAL.includes(c as PunctuationTokens);
	private isNotNewline = (c: string) => c !== "\n";
	private isNotEndOfStatement = (c: string) => c !== "\n" && c !== ";";
	private isKeyword = (c: string) => (Grammar.Keywords as readonly string[]).includes(c);
	private isWhitespace = (c: string) => c.match("%s")[0] !== undefined && c !== "\n";
	private isId = (c: string) => c.match("[%w_]")[0] !== undefined;
	private isOptionId = (c: string) => c.match("[%w_-]")[0] !== undefined;

	/**
	 * Resets the stream pointer to the beginning
	 */
	public reset() {
		this.stream.reset();
	}

	/**
	 * Reads while the specified condition is met, or the end of stream
	 */
	private readWhile(condition: (str: string) => boolean) {
		let src = "";
		while (this.stream.hasNext() === true && condition(this.stream.peek()) === true) {
			src += this.stream.next();
		}
		return src;
	}

	public parseLongString(character: string) {
		let str = "";
		const src = new Array<string>();
		const vars = new Array<string>();
		let escaped = false;

		this.stream.next(); // eat start character

		while (this.stream.hasNext()) {
			const char = this.stream.next();
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (char === character) {
				break;
			} else if (char === TokenCharacter.Dollar) {
				src.push(str);
				str = "";
				const id = this.readWhile(this.isId);
				vars.push(id);
				continue;
			}

			str += char;
		}

		if (str !== "") {
			src.push(str);
		}

		return [src, vars];
	}

	/**
	 * Reads a comment
	 * `# comment example`
	 */
	private readComment() {
		const result = this.readWhile(this.isNotNewline);
		return result;
	}

	private readStringToken(startCharacter: string) {
		const startPos = this.stream.getPtr() + 1; // ¯\_(ツ)_/¯
		const [values, variables] = this.parseLongString(startCharacter);
		const endPos = this.stream.getPtr();

		if (variables.size() === 0) {
			return identity<StringToken>({
				kind: ZrTokenKind.String,
				value: values.join(" "),
				startPos,
				endPos,
				quotes: startCharacter,
			});
		} else {
			return identity<InterpolatedStringToken>({
				kind: ZrTokenKind.InterpolatedString,
				values,
				value: joinInterpolatedString(values, variables),
				variables,
				startPos,
				endPos,
				quotes: startCharacter,
			});
		}
	}

	private parseBoolean(value: string) {
		if (value === "true") {
			return true;
		}

		return false;
	}

	private readLiteralString() {
		const startPos = this.stream.getPtr() + 1;
		const literal = this.readWhile(
			(c) =>
				this.isNotEndOfStatement(c) &&
				!this.isWhitespace(c) &&
				!this.isSpecial(c) &&
				c !== TokenCharacter.DoubleQuote &&
				c !== TokenCharacter.SingleQuote &&
				c !== "\n",
		);
		const endPos = this.stream.getPtr();

		if (this.isKeyword(literal)) {
			return identity<KeywordToken>({
				kind: ZrTokenKind.Keyword,
				startPos,
				endPos,
				value: literal,
			});
		}

		if (ZrLexer.BOOLEAN.includes(literal as BooleanLiteralTokens)) {
			return identity<BooleanToken>({
				kind: ZrTokenKind.Boolean,
				startPos,
				endPos,
				value: this.parseBoolean(literal),
				rawText: literal,
			});
		}

		return identity<StringToken>({
			kind: ZrTokenKind.String,
			startPos,
			endPos,
			value: literal,
		});
	}

	private readNumber() {
		const startPos = this.stream.getPtr() + 1;
		const number = this.readWhile(this.isNumeric);
		const endPos = this.stream.getPtr();
		return identity<NumberToken>({
			kind: ZrTokenKind.Number,
			value: tonumber(number)!,
			startPos,
			endPos,
			rawText: number,
		});
	}

	private readVariableToken() {
		const startPos = this.stream.getPtr() + 1;
		const properties = new Array<string>();

		// skip $
		this.stream.next();

		// read the id
		const id = this.readWhile(this.isId);

		// read any property access
		while (this.stream.hasNext() && this.stream.peek() === ".") {
			this.stream.next();
			properties.push(this.readWhile(this.isId));
		}

		const endPos = this.stream.getPtr();

		if (properties.size() > 0) {
			return identity<PropertyAccessToken>({
				kind: ZrTokenKind.PropertyAccess,
				startPos,
				endPos,
				properties,
				value: id,
			});
		} else {
			return identity<IdentifierToken>({
				kind: ZrTokenKind.Identifier,
				startPos,
				endPos,
				value: id,
			});
		}
	}

	private readOption(prefix: string) {
		const startPos = this.stream.getPtr() + 1;
		const optionName = this.readWhile(this.isOptionId);
		const endPos = this.stream.getPtr();
		return identity<OptionToken>({
			kind: ZrTokenKind.Option,
			value: optionName,
			startPos,
			endPos,
			prefix,
		});
	}

	/**
	 * Gets the next token
	 */
	private readNext(): Token | undefined {
		// skip whitespace
		this.readWhile(this.isWhitespace);
		const startPos = this.stream.getPtr() + 1;

		if (!this.stream.hasNext()) {
			return undefined;
		}

		// Get the next token
		const char = this.stream.peek();

		if (char === TokenCharacter.Hash) {
			this.readComment();
			return this.readNext();
		}

		// if (char === TokenCharacter.Dot) {
		// 	return this.readDotToken();
		// }

		if (char === TokenCharacter.Dollar) {
			return this.readVariableToken();
		}

		// Handle double quote and single quote strings
		if (char === TokenCharacter.DoubleQuote || char === TokenCharacter.SingleQuote) {
			return this.readStringToken(char);
		}

		if (char === TokenCharacter.Dash) {
			const nextChar = this.stream.peek(1);
			if (nextChar === TokenCharacter.Dash) {
				// if dash dash prefix (aka 'option')
				this.stream.next(2); // strip both dashes
				return this.readOption("--");
			}
		}

		if (this.isNumeric(char)) {
			return this.readNumber();
		}

		if (ZrLexer.OPERATORS.includes(char as OperatorTokens)) {
			return identity<OperatorToken>({
				kind: ZrTokenKind.Operator,
				startPos,
				endPos: startPos + char.size(),
				value: this.readWhile((c) => ZrLexer.OPERATORS.includes(c as OperatorTokens)),
			});
		}

		if (ZrLexer.ENDOFSTATEMENT.includes(char as EndOfStatementTokens)) {
			return identity<EndOfStatementToken>({
				kind: ZrTokenKind.EndOfStatement,
				startPos,
				endPos: startPos,
				value: this.stream.next(),
			});
		}

		if (ZrLexer.SPECIAL.includes(char as PunctuationTokens)) {
			return identity<SpecialToken>({
				kind: ZrTokenKind.Special,
				startPos,
				endPos: startPos,
				value: this.stream.next(),
			});
		}

		return this.readLiteralString();
	}

	public isNextOfKind(kind: ZrTokenKind) {
		return this.peek()?.kind === kind;
	}

	public isNextOfAnyKind(...kind: ZrTokenKind[]) {
		for (const k of kind) {
			if (this.isNextOfKind(k)) {
				return true;
			}
		}
		return false;
	}

	private currentToken: Token | undefined;
	public peek() {
		this.currentToken = this.currentToken ?? this.readNext();
		return this.currentToken;
	}

	public next() {
		const token = this.currentToken ?? this.readNext();
		this.currentToken = undefined;
		return token;
	}

	public hasNext() {
		return this.stream.hasNext();
	}
}
