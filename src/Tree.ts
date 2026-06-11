import { Parser, Language } from 'web-tree-sitter';

let parser: Parser;

const node_type = ['function_definition','class_definition','expression_statement','if_statement','for_statement','while_statement'];

export async function initParser(){
    await Parser.init();
    const lang = await Language.load("E:/zoho/chatbot/parser/tree-sitter-python.wasm");
    parser = new Parser();
    parser.setLanguage(lang);
}

function findNode(node: Parser.SyntaxNode,line: number){
    const start = node.startPosition.row + 1;
    const end = node.endPosition.row + 1;

    if (!(start <= line && line <= end)) {
        return null;
    }

    for(const child of node.children){
        const res = findNode(child,line);

        if(res){
            return res;
        }
    }

    return node
}

function findNearestParent(node: Parser.SyntaxNode){
    let current = node;

    while(current.parent){
        if(node_type.includes(current.type)){
            return current;
        }
        current = current.parent;
    }

    return node;
}

export async function getCodeBlock(code: string,line: number){
    const tree = parser.parse(code);

    const root = tree.rootNode;

    const problemNode = findNode(root,line);    
    const res = findNearestParent(problemNode);
    console.log(res.type);
    return res;
}