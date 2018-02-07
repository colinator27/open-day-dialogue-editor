function isStringValid(str){
    return (str.replace(/[A-z\_][A-z0-9\.\_]*/, "") == "");
}