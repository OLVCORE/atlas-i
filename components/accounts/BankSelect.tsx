"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BRAZILIAN_BANKS, type Bank } from "@/lib/utils/banks"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

type BankSelectProps = {
  name: string
  defaultValue?: string
  value?: string
  onChange?: (code: string) => void
  className?: string
}

export function BankSelect({ name, defaultValue, value, onChange, className }: BankSelectProps) {
  const initialBank = value 
    ? BRAZILIAN_BANKS.find(b => b.code === value)
    : defaultValue 
      ? BRAZILIAN_BANKS.find(b => b.code === defaultValue)
      : null
  
  const [selectedBank, setSelectedBank] = useState<Bank | null>(initialBank)
  const [search, setSearch] = useState(selectedBank ? `${selectedBank.code} - ${selectedBank.name}` : "")
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Atualizar quando value mudar externamente
  useEffect(() => {
    if (value) {
      const bank = BRAZILIAN_BANKS.find(b => b.code === value)
      if (bank) {
        setSelectedBank(bank)
        setSearch(`${bank.code} - ${bank.name}`)
      }
    } else if (value === "") {
      setSelectedBank(null)
      setSearch("")
    }
  }, [value])

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Filtrar bancos baseado na busca
  const filteredBanks = BRAZILIAN_BANKS.filter((bank) => {
    const searchLower = search.toLowerCase()
    return (
      bank.code.includes(searchLower) ||
      bank.name.toLowerCase().includes(searchLower)
    )
  })

  const handleSelect = (bank: Bank) => {
    setSelectedBank(bank)
    setSearch(`${bank.code} - ${bank.name}`)
    setIsOpen(false)
    if (onChange) {
      onChange(bank.code)
    }
    if (inputRef.current) {
      inputRef.current.blur()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearch(value)
    setIsOpen(true)
    
    // Se o usuário começar a digitar algo diferente do banco selecionado, limpar seleção
    if (selectedBank) {
      const selectedValue = `${selectedBank.code} - ${selectedBank.name}`
      if (value !== selectedValue) {
        setSelectedBank(null)
      }
    }
  }

  const handleInputFocus = () => {
    setIsOpen(true)
  }

  const displayValue = search

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={selectedBank?.code || ""} />
      <Input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder="Buscar banco por código ou nome..."
        className="w-full"
        autoComplete="off"
      />
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {filteredBanks.length > 0 ? (
            <div className="p-1">
              {filteredBanks.map((bank) => (
                <div
                  key={bank.code}
                  onClick={() => handleSelect(bank)}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    selectedBank?.code === bank.code && "bg-accent"
                  )}
                >
                  {selectedBank?.code === bank.code && (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  <span className={cn(selectedBank?.code === bank.code && "ml-6")}>
                    <span className="font-medium">{bank.code}</span> - {bank.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-2 text-sm text-muted-foreground text-center">
              Nenhum banco encontrado
            </div>
          )}
        </div>
      )}
    </div>
  )
}
