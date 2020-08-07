import { CmdSyntaxKind } from "./Enum";
import { Node, ParentNode } from "./NodeTypes";

export function getKindName(kind: CmdSyntaxKind | undefined) {
	if (kind === undefined) {
		return "<none>";
	}

	return CmdSyntaxKind[kind];
}

export function getNodeKindName(node: Node) {
	if (node === undefined) {
		return "<none>";
	}

	return getKindName(node.kind);
}

export function offsetNodePosition(node: Node, offset: number) {
	if (node.pos !== undefined && node.endPos !== undefined) {
		node.pos += offset;
		node.endPos += offset;
	}

	if ("children" in node) {
		for (const child of node.children) {
			offsetNodePosition(child, offset);
		}
	} else if ("values" in node) {
		for (const child of node.values) {
			offsetNodePosition(child, offset);
		}
	} else if ("expression" in node) {
		offsetNodePosition(node.expression, offset);
	}
}

export function isParentNode(node: Node): node is ParentNode {
	return "children" in node;
}

export function getNextNode(node: Node): Node | undefined {
	const { parent } = node;
	if (parent && isParentNode(parent)) {
		const index = parent.children.indexOf(node) + 1;
		return parent.children[index];
	}
}

export function getPreviousNode(node: Node): Node | undefined {
	const { parent } = node;
	if (parent && isParentNode(parent)) {
		const index = parent.children.indexOf(node) - 1;
		return parent.children[index];
	}
}
