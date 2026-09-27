from typing import List
from app.schemas.core import ImageRecognitionResult, ParsedExercise, Token

class StructuredParser:
    def parse(self, recognition_result: ImageRecognitionResult) -> ParsedExercise:
        if recognition_result.status == "NO_DETECTIONS":
            return ParsedExercise(operationType="UNKNOWN", operands=[], result="", tokens=[], status="NO_CONTENT_DETECTED")

        if recognition_result.status == "OUT_OF_SCOPE":
            return ParsedExercise(operationType="UNKNOWN", operands=[], result="", tokens=[], status="OUT_OF_SCOPE")
            
        if recognition_result.status == "UNCERTAIN_RECOGNITION":
            return ParsedExercise(operationType="UNKNOWN", operands=[], result="", tokens=recognition_result.tokens, status="UNCERTAIN_STRUCTURE")
            
        tokens = recognition_result.tokens
        
        # Group by rows (0, 1, 2)
        rows = {0: [], 1: [], 2: []}
        operator = None
        for t in tokens:
            if t.row is not None and t.row in rows:
                rows[t.row].append(t)
            if t.tokenClass == "operator":
                operator = t.value
                
        # Sort each row by column (descending to read left-to-right correctly if column 0 is ones, column 1 is tens)
        # Assuming column 0 is units, 1 is tens, etc.
        for r in rows:
            rows[r].sort(key=lambda x: x.column if x.column is not None else -1, reverse=True)
            
        def build_number(row_tokens: List[Token]) -> str:
            digits = [t.value for t in row_tokens if t.tokenClass == "digit"]
            return "".join(digits)
            
        op1 = build_number(rows[0])
        op2 = build_number(rows[1])
        res = build_number(rows[2])
        
        op_type = "UNKNOWN"
        if operator == "+":
            op_type = "VERTICAL_ADDITION"
        elif operator == "-":
            op_type = "VERTICAL_SUBTRACTION"
            
        if not op1 or not op2 or not res or op_type == "UNKNOWN":
            return ParsedExercise(operationType=op_type, operands=[op1, op2], result=res, tokens=tokens, status="INVALID_LAYOUT")
            
        return ParsedExercise(
            operationType=op_type,
            operands=[op1, op2],
            result=res,
            tokens=tokens,
            status="VALID_STRUCTURE"
        )
