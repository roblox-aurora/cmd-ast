import { CmdTypeDefinition } from "../CommandType";

export const PlayerType: CmdTypeDefinition<Player[], Player> = {
	transform(value, executor) {
		return game
			.GetService("Players")
			.GetPlayers()
			.filter((f) => f.Name.startsWith(value));
	},
	validate(value) {
		return value.size() > 0 ? { success: true } : { success: false, reason: "No matching players" };
	},
	parse(value) {
		return value[0];
	},
};
