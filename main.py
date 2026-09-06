import os
import sys

# Asegurar que python_engine esté en el path para importar sus módulos
current_dir = os.path.dirname(os.path.abspath(__file__))
python_engine_dir = os.path.join(current_dir, "python_engine")
if python_engine_dir not in sys.path:
    sys.path.insert(0, python_engine_dir)

# Cambiar el directorio de trabajo a python_engine si es necesario
os.chdir(python_engine_dir)

from server import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"Servidor Web iniciado en el puerto {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
