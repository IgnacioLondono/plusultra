@echo off
echo Renombrando carpeta a plusultra...
cd /d "%USERPROFILE%\Desktop"
if exist "plusultra" (
  echo La carpeta plusultra ya existe.
  exit /b 1
)
if not exist "Nueva carpeta (3)" (
  echo No se encontro "Nueva carpeta (3)" en el Escritorio.
  exit /b 1
)
ren "Nueva carpeta (3)" plusultra
echo Listo! Carpeta renombrada a: %USERPROFILE%\Desktop\plusultra
echo Abre esa carpeta en Cursor.
pause
