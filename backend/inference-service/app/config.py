from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict


class Settings(BaseSettings):
    inference_host: str = Field(default="0.0.0.0", alias="INFERENCE_HOST")
    inference_port: int = Field(default=8000, alias="INFERENCE_PORT")
    model_path: str = Field(
        default="../../ml-pipeline/models/final/road_sense_model.h5",
        alias="MODEL_PATH",
    )
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")
    default_confidence_threshold: float = Field(
        default=0.7, alias="DEFAULT_CONFIDENCE_THRESHOLD"
    )
    store_smooth_windows: bool = Field(default=True, alias="STORE_SMOOTH_WINDOWS")
    cluster_radius_meters: float = Field(default=12.0, alias="CLUSTER_RADIUS_METERS")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return (
            init_settings,
            dotenv_settings,
            env_settings,
            file_secret_settings,
        )

    @property
    def resolved_model_path(self) -> Path:
        base_dir = Path(__file__).resolve().parent.parent
        return (base_dir / self.model_path).resolve()

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
