/**
 * App History Stack - Histórico interno de navegação do app
 * Armazena apenas rotas internas (/app/**)
 * Limite: 20 entradas (FIFO)
 */

const MAX_HISTORY_SIZE = 20

class AppHistoryStack {
  private history: string[] = []
  private currentIndex: number = -1

  /**
   * Adiciona uma rota ao histórico
   * Ignora duplicações consecutivas
   */
  push(route: string): void {
    // Apenas rotas internas do app
    if (!route.startsWith("/app")) {
      return
    }

    // Ignorar duplicação consecutiva
    if (this.history[this.currentIndex] === route) {
      return
    }

    // Remover entradas futuras se houver (navegação não-linear)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1)
    }

    // Adicionar nova rota
    this.history.push(route)
    this.currentIndex = this.history.length - 1

    // Limitar tamanho (FIFO)
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history.shift()
      this.currentIndex--
    }
  }

  /**
   * Retorna a rota anterior (back)
   */
  getBackRoute(): string | null {
    if (this.currentIndex > 0) {
      return this.history[this.currentIndex - 1]
    }
    return null
  }

  /**
   * Retorna a rota seguinte (forward)
   */
  getForwardRoute(): string | null {
    if (this.currentIndex < this.history.length - 1) {
      return this.history[this.currentIndex + 1]
    }
    return null
  }

  /**
   * Move para a rota anterior
   */
  goBack(): string | null {
    const route = this.getBackRoute()
    if (route) {
      this.currentIndex--
      return route
    }
    return null
  }

  /**
   * Move para a rota seguinte
   */
  goForward(): string | null {
    const route = this.getForwardRoute()
    if (route) {
      this.currentIndex++
      return route
    }
    return null
  }

  /**
   * Verifica se pode voltar
   */
  canGoBack(): boolean {
    return this.currentIndex > 0
  }

  /**
   * Verifica se pode avançar
   */
  canGoForward(): boolean {
    return this.currentIndex < this.history.length - 1
  }

  /**
   * Retorna a rota atual
   */
  getCurrentRoute(): string | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return this.history[this.currentIndex]
    }
    return null
  }

  /**
   * Reinicia o histórico (útil para logout ou reset)
   */
  reset(): void {
    this.history = []
    this.currentIndex = -1
  }
}

// Singleton global
let historyInstance: AppHistoryStack | null = null

export function getAppHistory(): AppHistoryStack {
  if (typeof window === "undefined") {
    // Server-side: retornar instância vazia
    return new AppHistoryStack()
  }
  if (!historyInstance) {
    historyInstance = new AppHistoryStack()
  }
  return historyInstance
}

