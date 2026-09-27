from pydantic import BaseModel, ConfigDict
from typing import Optional

class ModelManifest(BaseModel):
    modelName: str
    modelVersion: str
    task: str
    framework: str
    artifactFilename: str
    artifactFormat: str
    sha256: str
    createdAt: Optional[str] = None
    datasetVersion: Optional[str] = None
    annotationSchemaVersion: Optional[str] = None
    inputWidth: Optional[int] = None
    inputHeight: Optional[int] = None
    inputChannels: Optional[int] = None
    preprocessing: Optional[str] = None
    labelMapVersion: Optional[str] = None
    metrics: Optional[dict] = None
    runtimeRequirements: Optional[str] = None
    frameworkVersion: Optional[str] = None
    architecture: Optional[str] = None
    labelMapFile: Optional[str] = None
    provenance: Optional[dict] = None

    model_config = ConfigDict(extra="ignore")
