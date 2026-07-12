
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Filter, 
  Plus, 
  Mail, 
  Phone, 
  MapPin, 
  Star,
  Users,
  MoreHorizontal,
  Eye,
  Edit
} from "lucide-react";
import { Consultant } from "@/entities/Consultant";
import ConsultantForm from "../components/consultants/ConsultantForm";
import PermissionGate from "@/components/common/PermissionGate";
import { DataTableProvider, SortableHead } from "@/components/common/DataTable";
import { useTableSort } from "@/hooks/useTableSort";

export default function Consultants() {
  const [consultants, setConsultants] = useState([]);
  const [filteredConsultants, setFilteredConsultants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadConsultants();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredConsultants(consultants);
      return;
    }

    const filtered = consultants.filter(consultant => 
      `${consultant.first_name} ${consultant.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consultant.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consultant.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consultant.specialization?.some(spec => spec.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredConsultants(filtered);
  }, [searchTerm, consultants]);

  const loadConsultants = async () => {
    try {
      const data = await Consultant.list("-created_date");
      setConsultants(data);
    } catch (error) {
      console.error("Error loading consultants:", error);
    }
    setLoading(false);
  };

  const handleAddConsultant = async (consultantData) => {
    try {
      await Consultant.create(consultantData);
      setShowForm(false);
      loadConsultants();
    } catch (error) {
      console.error("Error adding consultant:", error);
    }
  };

  const getAvailabilityColor = (availability) => {
    const colors = {
      available: "bg-green-100 text-green-800",
      busy: "bg-yellow-100 text-yellow-800",
      unavailable: "bg-red-100 text-red-800"
    };
    return colors[availability] || colors.available;
  };

  // Columns whose display value differs from a raw field get an accessor.
  const sortAccessors = useMemo(
    () => ({
      name: (c) => `${c.first_name || ""} ${c.last_name || ""}`.trim(),
      rate: (c) => (c.rate_min != null ? Number(c.rate_min) : null),
      specialization: (c) => c.specialization?.[0] || "",
    }),
    []
  );
  const sort = useTableSort(filteredConsultants, {
    defaultKey: "created_date",
    defaultOrder: "desc",
    accessors: sortAccessors,
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Consultants</h1>
          <p className="text-slate-600 mt-1">Manage independent contractors and consultants</p>
        </div>
        <PermissionGate entity="Consultant" action="create">
          <Button 
            onClick={() => setShowForm(true)}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Add Consultant
          </Button>
        </PermissionGate>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search consultants by name, company, or specialization..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2 whitespace-nowrap">
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Showing {filteredConsultants.length} of {consultants.length} consultants
        </p>
      </div>

      {/* Consultants Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-2 text-slate-600">Loading consultants...</p>
            </div>
          ) : filteredConsultants.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2">No consultants found</h3>
              <p className="text-slate-600 mb-4">
                {searchTerm ? "Try adjusting your search criteria" : "Get started by adding your first consultant"}
              </p>
              <PermissionGate entity="Consultant" action="create">
                <Button onClick={() => setShowForm(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add First Consultant
                </Button>
              </PermissionGate>
            </div>
          ) : (
            <DataTableProvider tableId="consultants" sort={sort}>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead columnKey="name">Name</SortableHead>
                  <SortableHead columnKey="company">Company</SortableHead>
                  <SortableHead columnKey="email">Contact</SortableHead>
                  <SortableHead columnKey="specialization">Specialization</SortableHead>
                  <SortableHead columnKey="rate">Rate</SortableHead>
                  <SortableHead columnKey="location">Location</SortableHead>
                  <SortableHead columnKey="availability">Availability</SortableHead>
                  <SortableHead columnKey="rating">Rating</SortableHead>
                  <SortableHead columnKey="actions" sortable={false}>Actions</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sort.sorted.map((consultant) => (
                  <TableRow key={consultant.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-900">
                          {consultant.first_name} {consultant.last_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          Added {new Date(consultant.created_date).toLocaleDateString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{consultant.company || "Not specified"}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="w-3 h-3" />
                          {consultant.email}
                        </div>
                        {consultant.phone && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Phone className="w-3 h-3" />
                            {consultant.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {consultant.specialization?.slice(0, 2).map((spec, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {spec}
                          </Badge>
                        ))}
                        {consultant.specialization?.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{consultant.specialization.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {consultant.rate_min && consultant.rate_max ? (
                        <div>
                          <p className="font-medium">${consultant.rate_min}-${consultant.rate_max}</p>
                          <p className="text-sm text-slate-600">per {consultant.rate_type}</p>
                        </div>
                      ) : (
                        "Not specified"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {consultant.location || "Not specified"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getAvailabilityColor(consultant.availability)}>
                        {consultant.availability}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {consultant.rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span>{consultant.rating}</span>
                        </div>
                      ) : (
                        "Not rated"
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <PermissionGate entity="Consultant" action="update">
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          </PermissionGate>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </DataTableProvider>
          )}
        </CardContent>
      </Card>

      {/* Add Consultant Form Modal */}
      {showForm && (
        <ConsultantForm
          onSave={handleAddConsultant}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
