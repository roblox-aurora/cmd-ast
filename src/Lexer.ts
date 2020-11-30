import ZrTextStream from "TextStream";
import Grammar, { BooleanLiteralTokens, EndOfStatementTokens, OperatorTokens, PunctuationTokens } from "Tokens/Grammar";
import {
	BooleanToken,
	CommentToken,
	EndOfStatementToken,
	IdentifierToken,
	InterpolatedStringToken,
	isToken,
	joinInterpolatedString,
	KeywordToken,
	NumberToken,
	OperatorToken,
	OptionToken,
	PropertyAccessToken,
	SpecialToken,
	StringToken,
	Token,
	WhitespaceToken,
	ZrTokenFlag,
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
	readonly ParseCommentsAsTokens: boolean;
	readonly ParseWhitespaceAsTokens: boolean;
	readonly CommandNames: string[];
}

const DEFAULTS = identity<LexerOptions>({
	ParseCommentsAsTokens: false,
	ParseWhitespaceAsTokens: false,
	CommandNames: [],
});

/**
 * The lexer for Zirconium
 */
export default class ZrLexer {
	private static readonly OPERATORS = Grammar.Operators;
	private static readonly ENDOFSTATEMENT = Grammar.EndOfStatement;
	private static readonly SPECIAL = Grammar.Punctuation;
	private static readonly BOOLEAN = Grammar.BooleanLiterals;
	private options: LexerOptions;

	public constructor(private stream: ZrTextStream, options?: Partial<LexerOptions>) {
		this.options = { ...DEFAULTS, ...options };
	}

	private isNumeric = (c: string) => c.match("[%d]")[0] !== undefined;
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

	public parseLongString(character: string): [source: string[], vars: string[], closed: boolean] {
		let str = "";
		const src = new Array<string>();
		const vars = new Array<string>();
		let escaped = false;
		let closed = false;

		this.stream.next(); // eat start character

		while (this.stream.hasNext()) {
			const char = this.stream.next();
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (char === character) {
				closed = true;
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

		return [src, vars, closed];
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
		const startPos = this.stream.getPtr(); // ¯\_(ツ)_/¯
		const [values, variables, closed] = this.parseLongString(startCharacter);
		const endPos = this.stream.getPtr();

		if (variables.size() === 0) {
			return identity<StringToken>({
				kind: ZrTokenKind.String,
				value: values.join(" "),
				startPos,
				closed,
				flags: closed ? ZrTokenFlag.None : ZrTokenFlag.UnterminatedString,
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
				flags: (closed ? ZrTokenFlag.None : ZrTokenFlag.UnterminatedString) | ZrTokenFlag.Interpolated,
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
		const startPos = this.stream.getPtr();
		const literal = this.readWhile(
			(c) =>
				this.isNotEndOfStatement(c) &&
				!this.isWhitespace(c) &&
				!this.isSpecial(c) &&
				c !== TokenCharacter.DoubleQuote &&
				c !== TokenCharacter.SingleQuote &&
				c !== "\n",
		);
		const endPos = this.stream.getPtr() - 1;

		if (this.isKeyword(literal)) {
			return identity<KeywordToken>({
				kind: ZrTokenKind.Keyword,
				startPos,
				endPos,
				flags: ZrTokenFlag.None,
				value: literal,
			});
		}

		if (ZrLexer.BOOLEAN.includes(literal as BooleanLiteralTokens)) {
			return identity<BooleanToken>({
				kind: ZrTokenKind.Boolean,
				startPos,
				endPos,
				flags: ZrTokenFlag.None,
				value: this.parseBoolean(literal),
				rawText: literal,
			});
		}

		const previous = this.prev(2);

		if (previous && this.prevIs(ZrTokenKind.Keyword, 2) && previous.value === "function") {
			return identity<IdentifierToken>({
				kind: ZrTokenKind.Identifier,
				startPos,
				endPos,
				flags: ZrTokenFlag.FunctionName,
				value: literal,
			});
		}

		return identity<StringToken>({
			kind: ZrTokenKind.String,
			startPos,
			endPos,
			closed: true,
			flags: ZrTokenFlag.None,
			value: literal,
		});
	}

	private readNumber() {
		const startPos = this.stream.getPtr();

		let isDecimal = false;
		const number = this.readWhile((c) => {
			if (c === ".") {
				if (isDecimal) {
					return false;
				}

				isDecimal = true;
				return true;
			}

			return this.isNumeric(c);
		});
		const endPos = this.stream.getPtr() - 1;
		return identity<NumberToken>({
			kind: ZrTokenKind.Number,
			value: tonumber(number)!,
			startPos,
			flags: ZrTokenFlag.None,
			endPos,
			rawText: number,
		});
	}

	private readVariableToken() {
		const startPos = this.stream.getPtr();
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

		const endPos = this.stream.getPtr() - 1;

		if (properties.size() > 0) {
			return identity<PropertyAccessToken>({
				kind: ZrTokenKind.PropertyAccess,
				startPos,
				endPos,
				flags: ZrTokenFlag.None,
				properties,
				value: id,
			});
		} else {
			return identity<IdentifierToken>({
				kind: ZrTokenKind.Identifier,
				startPos,
				flags: ZrTokenFlag.None,
				endPos,
				value: id,
			});
		}
	}

	private readOption(prefix: string) {
		const startPos = this.stream.getPtr();
		const optionName = this.readWhile(this.isOptionId);
		const endPos = this.stream.getPtr() - 1;
		return identity<OptionToken>({
			kind: ZrTokenKind.Option,
			value: optionName,
			flags: ZrTokenFlag.None,
			startPos,
			endPos,
			prefix,
		});
	}

	/**
	 * Gets the next token
	 */
	private readNext(): Token | undefined {
		const { options } = this;

		// skip whitespace
		if (!options.ParseWhitespaceAsTokens) this.readWhile(this.isWhitespace);
		const startPos = this.stream.getPtr();

		if (!this.stream.hasNext()) {
			return undefined;
		}

		// Get the next token
		const char = this.stream.peek();

		if (options.ParseWhitespaceAsTokens && this.isWhitespace(char)) {
			this.stream.next();
			return identity<WhitespaceToken>({
				kind: ZrTokenKind.Whitespace,
				value: char,
				flags: ZrTokenFlag.None,
				startPos: startPos,
				endPos: startPos,
			});
		}

		if (char === TokenCharacter.Hash) {
			const value = this.readComment();
			if (options.ParseCommentsAsTokens) {
				return identity<CommentToken>({
					kind: ZrTokenKind.Comment,
					value,
					flags: ZrTokenFlag.None,
					startPos,
					endPos: startPos + value.size(),
				});
			}
			return this.readNext();
		}

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
				flags: ZrTokenFlag.None,
				endPos: startPos + char.size(),
				value: this.readWhile((c) => ZrLexer.OPERATORS.includes(c as OperatorTokens)),
			});
		}

		if (ZrLexer.ENDOFSTATEMENT.includes(char as EndOfStatementTokens)) {
			return identity<EndOfStatementToken>({
				kind: ZrTokenKind.EndOfStatement,
				startPos,
				flags: ZrTokenFlag.None,
				endPos: startPos,
				value: this.stream.next(),
			});
		}

		if (ZrLexer.SPECIAL.includes(char as PunctuationTokens)) {
			if (char === ":") {
				const prev = this.prevSkipWhitespace();
				if (prev) {
					prev.flags |= ZrTokenFlag.Label;
				}
			}

			return identity<SpecialToken>({
				kind: ZrTokenKind.Special,
				startPos,
				endPos: startPos,
				flags: ZrTokenFlag.None,
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

	private fetchNextToken() {
		if (this.currentToken) {
			return this.currentToken;
		} else {
			const nextToken = this.readNext();
			if (nextToken) this.previousTokens.push(nextToken);
			return nextToken;
		}
	}

	private previousTokens = new Array<Token>();
	private currentToken: Token | undefined;
	public peek() {
		this.currentToken = this.fetchNextToken();
		return this.currentToken;
	}

	public prev(offset = 1) {
		assert(offset > 0);
		return this.previousTokens[this.previousTokens.size() - offset];
	}

	public prevSkipWhitespace(offset = 1) {
		assert(offset > 0);
		for (let i = this.previousTokens.size() - offset; i > 0; i--) {
			const token = this.previousTokens[i];
			if (token.kind !== ZrTokenKind.Whitespace) {
				return token;
			}
		}

		return undefined;
	}

	public prevIs(kind: ZrTokenKind, offset?: number) {
		const prev = this.prev(offset);
		return prev?.kind === kind;
	}

	public next() {
		const token = this.fetchNextToken();
		this.currentToken = undefined;
		return token;
	}

	public hasNext() {
		return this.stream.hasNext();
	}
}
