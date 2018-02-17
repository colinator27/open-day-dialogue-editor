// Checks if an identifier is valid
function isStringValid(str){
    let s = str.replace(/[A-z\_][A-z0-9\.\_]*/, "");

    // Make sure keywords begin with a "@" symbol
    if (/^(?:if|else|namespace|definitions|scene|choice)$/.test(str)){
        return false;
    } else if(/^\@.*$/.test(str) && s == "@"){
        return true;
    }

    // If everything matches, return true
    return (s == "");
}