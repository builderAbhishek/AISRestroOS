from fastapi import HTTPException, status


class AISRestroException(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, details: dict = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class RestaurantNotConfiguredException(AISRestroException):
    def __init__(self, message: str = "Restaurant has not been configured yet. Please complete initial setup."):
        super().__init__(message=message, status_code=status.HTTP_404_NOT_FOUND)


class EntityNotFoundException(AISRestroException):
    def __init__(self, entity_name: str, entity_id: str):
        super().__init__(
            message=f"{entity_name} with id '{entity_id}' not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class TableOccupiedException(AISRestroException):
    def __init__(self, table_number: str, existing_order_id: str):
        super().__init__(
            message=f"Table {table_number} already has an active order ({existing_order_id}).",
            status_code=status.HTTP_409_CONFLICT,
            details={"table_number": table_number, "order_id": existing_order_id},
        )


class InvalidOrderStateException(AISRestroException):
    def __init__(self, message: str):
        super().__init__(message=message, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)


class PaymentValidationException(AISRestroException):
    def __init__(self, message: str):
        super().__init__(message=message, status_code=status.HTTP_400_BAD_REQUEST)
