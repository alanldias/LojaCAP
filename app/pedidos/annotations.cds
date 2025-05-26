using ShopService as service from '../../srv/services';

annotate service.Pedidos with @(
    // --- FieldGroup e Facets permanecem os mesmos ---
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'total',
                Value : total,
            },
            {
                $Type : 'UI.DataField',
                Label : 'pagamento',
                Value : pagamento,
            },
            {
                $Type : 'UI.DataField',
                Label : 'status',
                Value : status,
                Criticality : statusCriticality,
                CriticalityRepresentation : #WithIcon
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],

    // --- LineItem com os campos ---
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'total',
            Value : total,
        },
        {
            $Type : 'UI.DataField',
            Label : 'pagamento',
            Value : pagamento,
        },
        {
            $Type : 'UI.DataField',
            Label : 'status',
            Value : status,
            Criticality : statusCriticality,          // Mantém a cor/ícone na célula
            CriticalityRepresentation : #WithIcon   // Mantém a cor/ícone na célula
        },
    ],

    // --- Adiciona o Highlight para colorir a linha inteira ---
    UI.Highlight : {
        $Type : 'UI.HighlightType',
        Criticality : statusCriticality // Usa o mesmo campo para a cor da linha
        // Opcional: Você pode adicionar 'Description' se quiser
        // Description : status
    }
);

// --- ValueList para o status permanece o mesmo ---
annotate service.Pedidos with {
  status @Common.ValueList: {
    $Type: 'Common.ValueListType',
    Label: 'Status do Pedido',
    CollectionPath: 'StatusPedidoEnum', // Certifique-se que StatusPedidoEnum está disponível
    Parameters: [
      {
        $Type: 'Common.ValueListParameterInOut',
        LocalDataProperty: status,
        ValueListProperty: 'code'
      },
      {
        $Type: 'Common.ValueListParameterDisplayOnly',
        ValueListProperty: 'text'
      }
    ]
  }
};