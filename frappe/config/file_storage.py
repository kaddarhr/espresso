from pydantic_settings import BaseSettings, SettingsConfigDict


class FileStorageConfig(BaseSettings, case_sensitive=False):
	model_config = SettingsConfigDict(env_prefix="file_storage_")
	s3_access_key: str
	s3_secret_key: str
	s3_endpoint: str
	s3_bucket: str
