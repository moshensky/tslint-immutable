/**
 * This file has code that is shared for all the ignore options.
 */

import * as ts from "typescript";
import * as Lint from "tslint";
import * as CheckNode from "./check-node";

export type Options = IgnoreLocalOption &
  IgnorePrefixOption &
  IgnoreClassOption &
  IgnoreInterfaceOption;

export interface IgnoreLocalOption {
  readonly ignoreLocal?: boolean;
}

export interface IgnorePrefixOption {
  readonly ignorePrefix?: string | Array<string> | undefined;
}

export interface IgnoreClassOption {
  readonly ignoreClass?: boolean;
}

export interface IgnoreInterfaceOption {
  readonly ignoreInterface?: boolean;
}

export function checkNodeWithIgnore(
  checkNode: CheckNode.CheckNodeFunction<Options>
): CheckNode.CheckNodeFunction<Options> {
  return (node: ts.Node, ctx: Lint.WalkContext<Options>) => {
    // Skip checking in functions if ignore-local is set
    if (
      ctx.options.ignoreLocal &&
      (node.kind === ts.SyntaxKind.FunctionDeclaration ||
        node.kind === ts.SyntaxKind.ArrowFunction ||
        node.kind === ts.SyntaxKind.FunctionExpression ||
        node.kind === ts.SyntaxKind.MethodDeclaration)
    ) {
      // We still need to check the parameters and return type
      const functionNode:
        | ts.FunctionDeclaration
        | ts.ArrowFunction
        | ts.MethodDeclaration = node as any; //tslint:disable-line
      const invalidNodes = checkIgnoreLocalFunctionNode(
        functionNode,
        ctx,
        checkNode
      );
      // Now skip this whole branch
      return { invalidNodes, skipChildren: true };
    }

    // Skip checking in classes/interfaces if ignore-class/ignore-interface is set
    if (
      (ctx.options.ignoreClass &&
        node.kind === ts.SyntaxKind.PropertyDeclaration) ||
      (ctx.options.ignoreInterface &&
        node.kind === ts.SyntaxKind.PropertySignature)
    ) {
      // Now skip this whole branch
      return { invalidNodes: [], skipChildren: true };
    }

    // Forward to check node
    return checkNode(node, ctx);
  };
}

function checkIgnoreLocalFunctionNode(
  functionNode:
    | ts.FunctionDeclaration
    | ts.ArrowFunction
    | ts.MethodDeclaration,
  ctx: Lint.WalkContext<{}>,
  checkNode: CheckNode.CheckNodeFunction<{}>
): ReadonlyArray<CheckNode.InvalidNode> {
  let myInvalidNodes: Array<CheckNode.InvalidNode> = [];

  // Check either the parameter's explicit type if it has one, or itself for implict type
  for (const n of functionNode.parameters.map(p => (p.type ? p.type : p))) {
    const { invalidNodes: invalidCheckNodes } = checkNode(n, ctx);
    if (invalidCheckNodes) {
      myInvalidNodes = myInvalidNodes.concat(...invalidCheckNodes);
    }
  }

  // Check the return type
  if (functionNode.type) {
    const { invalidNodes: invalidCheckNodes } = checkNode(
      functionNode.type,
      ctx
    );
    if (invalidCheckNodes) {
      myInvalidNodes = myInvalidNodes.concat(...invalidCheckNodes);
    }
  }

  return myInvalidNodes;
}

export function shouldIgnorePrefix(
  node: ts.Node,
  options: IgnorePrefixOption,
  sourceFile: ts.SourceFile
): boolean {
  // Check ignore-prefix for VariableDeclaration, PropertySignature, TypeAliasDeclaration, Parameter
  if (options.ignorePrefix) {
    if (
      node &&
      (node.kind === ts.SyntaxKind.VariableDeclaration ||
        node.kind === ts.SyntaxKind.Parameter ||
        node.kind === ts.SyntaxKind.PropertySignature ||
        node.kind === ts.SyntaxKind.PropertyDeclaration ||
        node.kind === ts.SyntaxKind.TypeAliasDeclaration)
    ) {
      const variableDeclarationNode = node as
        | ts.VariableDeclaration
        | ts.PropertySignature
        | ts.TypeAliasDeclaration
        | ts.ParameterDeclaration;
      const variableText = variableDeclarationNode.name.getText(sourceFile);
      // if (
      //   variableText.substr(0, options.ignorePrefix.length) ===
      //   options.ignorePrefix
      // ) {
      //   return true;
      // }
      if (isIgnoredPrefix(variableText, options.ignorePrefix)) {
        return true;
      }
    }
  }
  return false;
}

export function isIgnoredPrefix(
  text: string,
  ignorePrefix: Array<string> | string | undefined
): boolean {
  if (!ignorePrefix) {
    return false;
  }
  if (Array.isArray(ignorePrefix)) {
    if (ignorePrefix.find(pfx => text.indexOf(pfx) === 0)) {
      return true;
    }
  } else {
    if (text.indexOf(ignorePrefix) === 0) {
      return true;
    }
  }
  return false;
}
