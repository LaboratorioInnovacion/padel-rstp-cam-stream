#!/bin/bash
# ================================================================
# Script de Deploy Local - WSL2 Docker
# ================================================================

set -e  # Exit on error

echo "🚀 Iniciando deploy local en WSL2..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================
# 1. Verificar Docker
# ============================================================
echo -e "\n${YELLOW}📦 Verificando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon no está corriendo${NC}"
    echo "Inicia Docker Desktop o ejecuta: sudo service docker start"
    exit 1
fi

echo -e "${GREEN}✅ Docker OK${NC}"

# ============================================================
# 2. Detener contenedores anteriores
# ============================================================
echo -e "\n${YELLOW}🛑 Deteniendo contenedores anteriores...${NC}"
docker compose down || true

# ============================================================
# 3. Limpiar imágenes antiguas (opcional)
# ============================================================
read -p "¿Limpiar imágenes antiguas? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🧹 Limpiando imágenes antiguas...${NC}"
    docker image prune -af
fi

# ============================================================
# 4. Build nueva imagen
# ============================================================
echo -e "\n${YELLOW}🔨 Building nueva imagen...${NC}"
docker compose build --no-cache

# ============================================================
# 5. Iniciar contenedores
# ============================================================
echo -e "\n${YELLOW}🚀 Iniciando contenedores...${NC}"
docker compose up -d

# ============================================================
# 6. Verificar estado
# ============================================================
echo -e "\n${YELLOW}📊 Estado de contenedores:${NC}"
docker compose ps

echo -e "\n${YELLOW}📋 Logs iniciales:${NC}"
docker compose logs --tail=50

# ============================================================
# 7. Health check
# ============================================================
echo -e "\n${YELLOW}🏥 Esperando health check...${NC}"
sleep 10

if curl -f http://localhost:3000/api/health &> /dev/null; then
    echo -e "${GREEN}✅ Servidor funcionando correctamente!${NC}"
    echo -e "\n${GREEN}🎉 Deploy completado!${NC}"
    echo -e "\n${YELLOW}📍 URLs disponibles:${NC}"
    echo "   • API: http://localhost:3000"
    echo "   • Health: http://localhost:3000/api/health"
    echo "   • Streams: http://localhost:3000/api/streams"
    echo "   • FRP Dashboard: http://localhost:7500"
    echo ""
    echo -e "${YELLOW}📝 Comandos útiles:${NC}"
    echo "   • Ver logs: docker compose logs -f"
    echo "   • Reiniciar: docker compose restart"
    echo "   • Detener: docker compose down"
    echo "   • Shell: docker compose exec frp-server bash"
else
    echo -e "${RED}❌ Health check falló${NC}"
    echo -e "\n${YELLOW}Mostrando logs completos:${NC}"
    docker compose logs
    exit 1
fi
