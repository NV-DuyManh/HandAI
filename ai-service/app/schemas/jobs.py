from uuid import UUID
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict


class JobRequest(BaseModel):
    jobId: UUID = Field(..., description="Spring-owned canonical jobId (required)")
    submissionId: str
    imageReference: str
    allowedOperations: List[str]
    maxDigits: int = 3
    oneExerciseOnly: bool = True
    policyVersion: str = "v1.2"
    policyMode: str = "STUDENT"          # STUDENT | TEACHER — always explicit from Spring


class JobResponse(BaseModel):
    jobId: str
    status: str


class GradeProposal(BaseModel):
    suggestedScore: int
    maxScore: int
    reason: str = ""          # why this grade was proposed
    confidence: float
    isOfficial: bool = False  # always False until TeacherDecision


class Evidence(BaseModel):
    evidenceId: str
    type: str
    boundingBox: Optional[List[float]] = None   # [x, y, w, h] normalized 0–1, origin top-left
    placeValue: Optional[str] = None
    ruleId: Optional[str] = None
    observedText: Optional[str] = None
    expectedRelation: Optional[str] = None
    observedRelation: Optional[str] = None
    confidence: float
    description: str


class StudentFeedback(BaseModel):
    """
    Canonical student feedback contract.
    Exactly one Socratic hint by default. revealAnswer is always false.
    """
    title: str
    hint: str
    focusEvidenceId: Optional[str] = None      # links to the first error evidence item
    revealAnswer: bool = False                 # must never be True in student policy


class AiCallbackRequest(BaseModel):
    status: str
    recognizedScore: Optional[int] = None
    recognizedExercise: Optional[str] = None
    gradeProposal: Optional[GradeProposal] = None
    evidence: Optional[List[Evidence]] = None
    studentFeedback: Optional[StudentFeedback] = None   # structured object (not plain string)
    confidenceBundle: Optional[Dict[str, float]] = None  # recognition/structure/diagnosis
    reasonCode: Optional[str] = None                     # machine-readable failure reason code
    diagnostics: Optional[Dict[str, Any]] = None         # stage attempt diagnostics (detectorInvoked, etc.)
    modelVersion: Optional[str] = None                   # canonical runtime model provenance
