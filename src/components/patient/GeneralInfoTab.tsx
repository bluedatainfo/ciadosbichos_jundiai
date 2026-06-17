import { Patient } from '@/lib/mock-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function GeneralInfoTab({ patient }: { patient: Patient }) {
  const { toast } = useToast()

  const handleSave = () => {
    toast({
      title: 'Sucesso',
      description: 'Dados gerais atualizados com sucesso.',
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card className="border-none shadow-sm">
        <CardHeader className="border-b bg-slate-50/50 pb-4">
          <CardTitle className="text-lg text-slate-800">Seção Tutor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1">
            <Label htmlFor="tutorName">Nome do Tutor</Label>
            <Input id="tutorName" defaultValue={patient.owner.name} className="bg-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" defaultValue={patient.owner.cpf} className="bg-white" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rg">RG</Label>
              <Input id="rg" defaultValue={patient.owner.rg} className="bg-white" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" defaultValue={patient.owner.address} className="bg-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                defaultValue={patient.owner.neighborhood}
                className="bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" defaultValue={patient.owner.city} className="bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1 col-span-1">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" defaultValue={patient.owner.state} className="bg-white" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label htmlFor="zip">CEP</Label>
              <Input id="zip" defaultValue={patient.owner.zip} className="bg-white" />
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <Label>Telefones</Label>
            {patient.owner.phones.map((phone, idx) => (
              <Input key={idx} defaultValue={phone} className="bg-white" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="border-b bg-slate-50/50 pb-4">
            <CardTitle className="text-lg text-slate-800">Seção Animal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="animalName">Nome</Label>
                <Input id="animalName" defaultValue={patient.name} className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="microchip">Microchip / ID Eletrônica</Label>
                <Input id="microchip" defaultValue={patient.microchip} className="bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="species">Espécie</Label>
                <Input id="species" defaultValue={patient.species} className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gender">Sexo</Label>
                <Input id="gender" defaultValue={patient.gender} className="bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="breed">Raça</Label>
                <Input id="breed" defaultValue={patient.breed} className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="color">Pelagem / Cores</Label>
                <Input id="color" defaultValue={patient.color} className="bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-1">
                <Label htmlFor="birth">Nascimento</Label>
                <Input
                  id="birth"
                  type="date"
                  defaultValue={patient.birthDate}
                  className="bg-white"
                />
              </div>
              <div className="flex items-center space-x-2 h-10 px-3 border rounded-md bg-white">
                <Checkbox id="isAlive" defaultChecked={patient.isAlive} />
                <Label htmlFor="isAlive" className="font-normal cursor-pointer">
                  Animal Vivo
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} className="gap-2 bg-primary hover:bg-primary/90">
            <Save className="w-4 h-4" />
            Salvar Alterações
          </Button>
        </div>
      </div>
    </div>
  )
}
