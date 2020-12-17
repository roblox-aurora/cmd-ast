
<center>
    <img src="https://assets.vorlias.com/i1/zirconium-ast.png"/>
</center>

# Zirconium AST
Lexer and Parser for the Zirconium DSL (Domain-specific Language) for use in Roblox.
More information in the [Zirconium project](https://github.com/roblox-aurora/zirconium).

### _Note: Documentation is WIP as the new parser is written_

## Features
### Using commands
```bash
command hello 10 true "Hello there $playerName!" # simple call
command("hello", 10, true, "Hello there $playerName!") # explicit call
```
A simple call is for quick & easy commands (and more like a command), explicit calls allow passing other commands as arguments and is more explicit and akin to regular programming.

- I'm possibly planning with Zircon that certain commands require 'explicit'

### Using Variables
```bash
$aNumber = 10
$aString = "Hello there!"
$aBoolean = true
```

### Using arrays
```bash
$arrayVariable = [ "string", true, 10, 5.5, "combined $variable string" ] #variable use
kill [ vorlias, augmin ]
kill([ "vorlias", "augmin" ])
```

Indexing
```bash
$array = [ "Hello, World!" ]
$helloWorld = $array.0 # will retrieve the first value
echo $helloWorld
```

### Using Pipes and Synchronous calls
```bash
command | command2 # Passes values from command to command2
command && command2 # Meant to only execute command2 if command succeeds
command || command2 # Meant to only execute command2 if command fails
```
Explicit calls can also be used with these.

### If Statement
```bash
$value = true

if $value { 
    echo "True!"
}

if $value: echo "True!" # Short form if, same as above

if $value {
    echo "True!"
} else {
    echo "False!"
}
```
The above would print `True!` three times.


## Block Scope
```bash
{
    $x = 10
    echo $x # x is 10
}

echo $x # x is out of scope, would be nil
```

## Functions
```ts
// No arguments
function functionName() {

}

// Implicit any
function functionName($argument) {

}

// With multiple arguments and types
function functionName($argument: string, $anotherArgument: number) {
    echo $argument $anotherArgument
}
```
