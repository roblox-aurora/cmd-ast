import { CmdCoreRegistryService } from "./RegistryService";
import CommandAstParser, { CommandAstInterpreter } from "@rbxts/cmd-ast";
import { isNode, CmdSyntaxKind, CommandStatement } from "@rbxts/cmd-ast/Nodes";

export namespace CmdCoreDispatchService {
    let Registry!: CmdCoreRegistryService;
    
    export const dependencies = ["RegistryService"];

    /** @internal */
    export function LoadDependencies(registry: CmdCoreRegistryService) {
        Registry = registry;
    }
    
    function executeStatement(statement: CommandStatement, executor: Player) {
        const interpreter = new CommandAstInterpreter(Registry._getCommandDeclarations());
        const result = interpreter.interpret(statement);

        for (const segment of result) {
            if (CommandAstInterpreter.isCommand(segment)) {
                const matchingCommand = Registry.GetCommands().find(c => c.command === segment.command);
                if (matchingCommand) {
                    matchingCommand.executeForPlayer(segment.options, segment.args, executor);
                }
            } else if(CommandAstInterpreter.isCommandSeqence(segment)) {
                warn("Cannot do sequence yet!");
            }
        }
        
    }

    export function Execute(text: string, executor: Player) {
        const commandAst = new CommandAstParser(text).Parse();
        for (const statement of commandAst.children) {
            if (isNode(statement, CmdSyntaxKind.CommandStatement)) {
                executeStatement(statement, executor);
            } else if (isNode(statement, CmdSyntaxKind.BinaryExpression)) {
                warn("Cannot run BinaryExpression yet!");
            }
        }
    }
}
export type CmdCoreDispatchService = typeof CmdCoreDispatchService;