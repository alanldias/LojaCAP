using ShopService as service from '../../srv/services';
annotate service.Produtos with @(
    UI.HeaderFacets : [
        
    ],
    UI.FieldGroup #Administrao : {
        $Type : 'UI.FieldGroupType',
        Data : [
        ],
    }
);

