from app.schemas.core import ParsedExercise

class VerticalSubtractionValidator:
    def validate(self, parsed: ParsedExercise) -> dict:
        if parsed.status != "VALID_STRUCTURE":
            return {"is_valid": False, "evidence": []}
            
        try:
            op1 = int(parsed.operands[0])
            op2 = int(parsed.operands[1])
            res = int(parsed.result)
            
            if op1 - op2 == res:
                return {"is_valid": True, "evidence": []}
            else:
                # Deterministic error localization (simplified for Phase 4.0 MVP)
                str_op1 = parsed.operands[0].zfill(6)
                str_op2 = parsed.operands[1].zfill(6)
                str_res = parsed.result.zfill(6)
                
                borrow = 0
                for i in range(5, -1, -1):
                    col_op1 = int(str_op1[i]) - borrow
                    col_op2 = int(str_op2[i])
                    col_res = int(str_res[i])
                    
                    next_borrow = 0
                    if col_op1 < col_op2:
                        col_op1 += 10
                        next_borrow = 1
                        
                    expected_digit = col_op1 - col_op2
                    
                    if col_res != expected_digit:
                        place_value = ["trăm nghìn", "chục nghìn", "nghìn", "trăm", "chục", "đơn vị"][i]
                        return {
                            "is_valid": False,
                            "evidence": [{
                                "evidenceId": "err_sub_1",
                                "type": "CARRY_BORROW_ERROR" if borrow > 0 else "COMPUTATION_ERROR",
                                "placeValue": f"Hàng {place_value}",
                                "ruleId": "SUB_COL_MISMATCH",
                                "confidence": 0.95,
                                "description": f"Phép trừ hàng {place_value} không khớp."
                            }]
                        }
                    borrow = next_borrow
                    
                return {"is_valid": False, "evidence": []}
        except ValueError:
            return {"is_valid": False, "evidence": []}
